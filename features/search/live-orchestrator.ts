/**
 * The live search orchestrator.
 *
 * Wires the whole pipeline: layered discovery → entity resolution → classified
 * evidence → hard-constraint filtering → broad ranking → paginated,
 * user-worded response, with caching, budgets, and diagnostics throughout.
 *
 * Part 13 is enforced at the top of `search()`: in production, if no live
 * discovery source is configured, this returns `search_unavailable`. It never
 * falls back to fixtures. A truthful outage beats a confident fiction.
 */

import { getCategory, listCategories } from "@/features/recommendation/categories/definitions";
import { scoreCandidate } from "@/features/recommendation/ranking/score";
import type { Entity } from "@/features/recommendation/entities/types";
import type { EntityRepository } from "@/features/entities/repository";

import { nowMs, type SearchContext, type StageIssue, type StageMetrics } from "./contracts";
import { ParseStage, ResolveStage, type AvailabilityProbe } from "./stages/interpret";
import { runLayeredDiscovery, type LayeredDiscoveryResult } from "./discovery/runner";
import type { CandidateDiscoveryAdapter, DiscoveryContext } from "./discovery/types";
import { AgenticDiscoveryAdapter } from "./discovery/agentic";
import { resolveCandidates, captureAliases, type ResolutionReport } from "./resolution/resolve";
import { classifyEvidence, stripOfficialReputation, type ClassifiedEvidence } from "./evidence/classes";
import { enforceIndependence, isBatchEvidenceSource, type EvidenceSource } from "./sources/types";
import { compareBroadScores, scoreBroad, type BroadScore } from "./ranking/profiles";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  type EvidenceCoverage,
  type PriceSummary,
  type RankedAttribute,
  type RankedResult,
  type RankedSearchResponse,
  type ReviewSummary,
  type SourceSummary,
} from "./response";
import * as copy from "./copy";
import { buildDiagnostics, maySeeDiagnostics, toLogLine, type SearchDiagnostics } from "./diagnostics";
import {
  DISCOVERY_CACHE,
  EnrichmentQueue,
  QUERY_CACHE,
  QueryPopularity,
  SearchCache,
  discoveryCacheKey,
  isSourceStale,
} from "./cache";
import { SearchBudget, budgetFromEnv } from "./providers/registry";
import { ReviewEvidenceSource } from "./reviews/default";

export interface LiveSearchInput {
  query: string;
  categoryId?: string;
  limit?: number;
  cursor?: string | null;
  /** Grants the full diagnostics block in production. */
  isAdmin?: boolean;
}

export interface LiveOrchestratorDeps {
  repo: EntityRepository;
  discoveryAdapters: CandidateDiscoveryAdapter[];
  evidenceSources: EvidenceSource[];
  availabilityProbe?: AvailabilityProbe;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  deadlineMs?: number;
  /** Production default true — see Part 13. */
  requireCanonical?: boolean;
  /** Set false ONLY for explicit demo mode. */
  requireLiveDiscovery?: boolean;
  discoveryCache?: SearchCache<LayeredDiscoveryResult>;
  queryCache?: SearchCache<RankedSearchResponse>;
  enrichmentQueue?: EnrichmentQueue;
  popularity?: QueryPopularity;
  /**
   * Shared entity lookup, populated per request before evidence gathering.
   * Review adapters match on domain, which `EvidenceRequest` alone cannot carry
   * richly enough — this hands them the full entity without widening the
   * `EvidenceSource` interface for every other source.
   */
  entityCache?: Map<string, Entity>;
}

export class LiveSearchOrchestrator {
  private readonly discoveryCache: SearchCache<LayeredDiscoveryResult>;
  private readonly enrichment: EnrichmentQueue;
  private readonly popularity: QueryPopularity;

  constructor(private readonly deps: LiveOrchestratorDeps) {
    this.discoveryCache = deps.discoveryCache ?? new SearchCache(DISCOVERY_CACHE);
    this.enrichment = deps.enrichmentQueue ?? new EnrichmentQueue();
    this.popularity = deps.popularity ?? new QueryPopularity();
  }

  get enrichmentQueue(): EnrichmentQueue {
    return this.enrichment;
  }

  async search(input: LiveSearchInput): Promise<RankedSearchResponse> {
    const startedAt = nowMs();
    const env = this.deps.env ?? process.env;
    const isProd = env.NODE_ENV === "production";
    const requestId = randomId();
    const budget = new SearchBudget(budgetFromEnv(env));

    const ctx: SearchContext = {
      requestId,
      now: this.deps.now?.() ?? new Date(),
      env,
      deadlineMs: this.deps.deadlineMs ?? 8_000,
      isDev: !isProd,
    };
    const showDiagnostics = maySeeDiagnostics(env, input.isAdmin);

    const issues: StageIssue[] = [];
    const metrics: StageMetrics[] = [];
    let rankingDurationMs = 0;
    let providerDurationMs = 0;

    const diag = (over: Partial<Parameters<typeof buildDiagnostics>[0]>): SearchDiagnostics =>
      buildDiagnostics({
        requestId,
        query: input.query,
        categoryId: null,
        domain: "unknown",
        resolutionStatus: "unknown",
        budget: budget.snapshot(),
        stageMetrics: metrics,
        partialFailures: issues,
        totalDurationMs: round(nowMs() - startedAt),
        providerDurationMs,
        rankingDurationMs,
        ...over,
      });

    const meta = (d: SearchDiagnostics) => ({
      requestId,
      timingMs: round(nowMs() - startedAt),
      ...(showDiagnostics ? { diagnostics: d } : {}),
    });

    try {
      this.popularity.record(input.query);

      // ── Part 13: no live discovery in production → say so, never pretend ──
      const liveRequired = this.deps.requireLiveDiscovery ?? isProd;
      const hasLiveAdapter = this.deps.discoveryAdapters.length > 0;
      if (liveRequired && !hasLiveAdapter) {
        const d = diag({ resolutionStatus: "unavailable" });
        logSearch(d, !isProd);
        return {
          ...meta(d),
          status: "error",
          code: "search_unavailable",
          message: copy.unavailableMessage(),
        };
      }

      // ── 1. parse ──────────────────────────────────────────────────────────
      const parse = await new ParseStage().run(
        { query: input.query, categoryId: input.categoryId },
        ctx
      );
      metrics.push(parse.metrics);
      issues.push(...parse.issues);
      const parsed = parse.output.parsed;

      // ── 2. resolve ────────────────────────────────────────────────────────
      const resolveStage = await new ResolveStage(this.deps.availabilityProbe).run(parse.output, ctx);
      metrics.push(resolveStage.metrics);
      issues.push(...resolveStage.issues);
      const { resolution, categoryId, categoryName, availability } = resolveStage.output;

      if (resolution.status === "unsupported") {
        const d = diag({ domain: resolution.domain, resolutionStatus: resolution.status });
        logSearch(d, !isProd);
        return {
          ...meta(d),
          status: "unsupported",
          query: parsed,
          title: "Not something Crossing covers yet",
          message: copy.unsupportedMessage(resolution.categoryLabel),
        };
      }

      if (resolution.status !== "supported" || !categoryId) {
        const d = diag({ domain: resolution.domain, resolutionStatus: resolution.status });
        logSearch(d, !isProd);
        return {
          ...meta(d),
          status: "needs-clarification",
          query: parsed,
          title: "Which kind of tool?",
          options: optionsFor(resolution.suggestedCategoryIds),
          message: copy.clarificationMessage(resolution.status === "ambiguous"),
        };
      }

      const name = categoryName ?? categoryId;
      const category = getCategory(categoryId)!;

      const baseDiag = {
        categoryId,
        domain: resolution.domain,
        resolutionStatus: resolution.status,
      };

      if (availability && !availability.viable) {
        const d = diag({ ...baseDiag });
        logSearch(d, !isProd);
        return {
          ...meta(d),
          status: "no-results",
          query: parsed,
          title: copy.resultTitle({ categoryName: name }),
          message: copy.emptyCategoryMessage(name),
          excluded: [],
          totalDiscovered: 0,
          totalEvaluated: 0,
          warnings: [],
        };
      }

      // ── 3. discover (layered + cached) ────────────────────────────────────
      const discoveryContext: DiscoveryContext = {
        ...ctx,
        categoryId,
        categoryName: name,
        rawQuery: parsed.rawQuery,
        wanted: 50,
      };

      const discoveryKey = discoveryCacheKey(categoryId, parsed.rawQuery);

      // Cache the WHOLE discovery result, not just the candidates: adapter
      // attribution, layers, and issued queries are required diagnostics, and
      // computing them in the loader closure would lose them on a cache hit.
      const cached = await this.discoveryCache.get(discoveryKey, async () =>
        runLayeredDiscovery(this.deps.discoveryAdapters, discoveryContext)
      );
      const discovery = cached.value;
      const discoveryCacheHit = cached.hit !== "miss";

      const rawCandidates = discovery.candidates;
      const byAdapter = discovery.byAdapter;
      const layersRun: string[] = discovery.layersRun;
      const queriesIssued = discovery.queriesIssued;
      // A cache hit costs nothing and spends no provider time — attributing the
      // original run's cost to it again would overstate spend on every hit.
      const discoveryCost = discoveryCacheHit ? 0 : discovery.costUsd;
      if (!discoveryCacheHit) providerDurationMs += discovery.metrics.durationMs;
      metrics.push(discovery.metrics);
      issues.push(...discovery.issues);

      // ── 4–5. resolve entities ─────────────────────────────────────────────
      const catalog = await this.loadCatalog(categoryId);
      const report: ResolutionReport = resolveCandidates(rawCandidates, catalog, {
        categoryId,
        queryLocation: parsed.location ?? null,
      });

      // Aliases/external ids are RETURNED for curation, never auto-applied —
      // a discovered page must not edit a canonical entity.
      const aliasCaptures = captureAliases(report);
      void aliasCaptures;

      for (const o of report.outcomes) {
        if (o.kind === "probable-duplicate") {
          issues.push({
            stage: "resolveEntities",
            code: "low_confidence",
            detail: o.reason,
            subject: o.candidate.name,
          });
        }
      }

      // ── 6. gather evidence (cached + background enrichment) ───────────────
      const evidenceStart = nowMs();
      const evidenceByEntity = await this.gatherEvidence(
        report.resolved.map((r) => r.entity),
        categoryId,
        ctx,
        issues
      );
      metrics.push({
        stage: "gatherEvidence",
        durationMs: round(nowMs() - evidenceStart),
        itemsIn: report.resolved.length,
        itemsOut: evidenceByEntity.size,
        externalCalls: 0,
      });

      // ── 7. filter (hard constraints) ──────────────────────────────────────
      const filterStart = nowMs();
      const eligible: {
        entity: Entity;
        evidence: ClassifiedEvidence;
        adapters: number;
        breakdown: ReturnType<typeof scoreCandidate>;
      }[] = [];
      const excluded: { name: string; reasons: string[] }[] = [];

      for (const group of report.resolved) {
        const classified = evidenceByEntity.get(group.entity.id);
        if (!classified) continue;
        const hydrated: Entity = { ...group.entity, evidence: classified.raw };
        const breakdown = scoreCandidate(hydrated, parsed, category, ctx.now);

        if (breakdown.eligible) {
          eligible.push({
            entity: hydrated,
            evidence: classified.classified,
            adapters: group.distinctAdapters,
            breakdown,
          });
        } else {
          excluded.push({ name: group.entity.canonicalName, reasons: breakdown.ineligibleReasons });
        }
      }
      metrics.push({
        stage: "filter",
        durationMs: round(nowMs() - filterStart),
        itemsIn: report.resolved.length,
        itemsOut: eligible.length,
        externalCalls: 0,
      });

      // ── 8. rank (broad, deterministic) ────────────────────────────────────
      const rankStart = nowMs();
      const scored = eligible.map((e) => ({
        ...e,
        score: scoreBroad({
          entity: e.entity,
          evidence: e.evidence,
          query: parsed,
          category,
          corroboratingAdapters: e.adapters,
          now: ctx.now,
        }),
      }));
      scored.sort((a, b) => compareBroadScores(a.score, b.score));
      rankingDurationMs = round(nowMs() - rankStart);
      metrics.push({
        stage: "rank",
        durationMs: rankingDurationMs,
        itemsIn: eligible.length,
        itemsOut: scored.length,
        externalCalls: 0,
      });

      // ── 9. paginate + respond ─────────────────────────────────────────────
      const limit = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const page = paginate(scored, (items) => items.map((i) => i.entity.id), {
        limit,
        cursor: input.cursor,
      });

      const offset = scored.findIndex((s) => s.entity.id === page.items[0]?.entity.id);
      const results: RankedResult[] = page.items.map((item, i) =>
        this.toRankedResult(item, (offset < 0 ? 0 : offset) + i + 1, name, showDiagnostics)
      );

      const withIndependent = scored.filter((s) => s.evidence.hasIndependent).length;
      const coverage = this.buildCoverage(scored.map((s) => s.evidence));

      const providerDegraded = issues.some(
        (i) => i.code === "source_timeout" || i.code === "source_rejected" || i.code === "budget_exhausted"
      );

      const d = diag({
        ...baseDiag,
        discoveryAdapters: Object.keys(byAdapter),
        discoveryLayers: layersRun,
        searchQueriesIssued: queriesIssued,
        rawCandidateCount: rawCandidates.length,
        dedupedCandidateCount: report.resolved.length,
        resolutionCounts: report.counts,
        evidenceSourceCount: this.deps.evidenceSources.length,
        entitiesWithIndependentEvidence: withIndependent,
        cacheHits: { query: false, discovery: discoveryCacheHit, evidence: 0 },
        estimatedCostUsd: discoveryCost,
        finalResultCount: results.length,
        agenticTrace: this.agenticTrace(),
      });
      logSearch(d, !isProd);

      if (results.length === 0) {
        return {
          ...meta(d),
          status: "no-results",
          query: parsed,
          title: copy.resultTitle({ categoryName: name }),
          message: copy.noResultsMessage(excluded.length),
          excluded,
          totalDiscovered: rawCandidates.length,
          totalEvaluated: report.resolved.length,
          warnings: copy.coverageWarnings({
            shown: 0,
            target: limit,
            withIndependentReviews: 0,
            providerDegraded,
          }),
        };
      }

      return {
        ...meta(d),
        status: "success",
        query: parsed,
        title: copy.resultTitle({
          categoryName: name,
          audience: parsed.intendedAudience,
          budgetMax: parsed.budget?.max ?? null,
        }),
        summary: copy.resultSummary({
          shown: results.length,
          evaluated: report.resolved.length,
          withIndependentReviews: withIndependent,
        }),
        results,
        totalDiscovered: rawCandidates.length,
        totalEvaluated: report.resolved.length,
        evidenceCoverage: coverage,
        warnings: copy.coverageWarnings({
          shown: scored.length,
          target: limit,
          withIndependentReviews: withIndependent,
          providerDegraded,
        }),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      };
    } catch (err) {
      console.error(`[search] ${requestId} failed:`, err);
      const d = diag({});
      return {
        ...meta(d),
        status: "error",
        code: "internal_error",
        message: "Something went wrong running that search. Please try again.",
      };
    }
  }

  // ─── Evidence ──────────────────────────────────────────────────────────────

  /**
   * Gather and classify evidence.
   *
   * Nothing is crawled here. Sources read stored snapshots; anything missing or
   * stale is ENQUEUED for the background worker and the request proceeds with
   * what exists. That is the "do not crawl synchronously" guarantee.
   */
  private async gatherEvidence(
    entities: Entity[],
    categoryId: string,
    ctx: SearchContext,
    issues: StageIssue[]
  ): Promise<Map<string, { raw: Entity["evidence"]; classified: ClassifiedEvidence }>> {
    const out = new Map<string, { raw: Entity["evidence"]; classified: ClassifiedEvidence }>();
    if (entities.length === 0) return out;

    // Publish this request's entities for sources that need more than an id.
    if (this.deps.entityCache) {
      this.deps.entityCache.clear();
      for (const e of entities) this.deps.entityCache.set(e.id, e);
    }

    const requests = entities.map((e) => ({
      entityId: e.id,
      entityName: e.canonicalName,
      domainKey: e.domainKey,
      categoryId,
    }));

    const collected = new Map<string, Entity["evidence"]>();
    for (const e of entities) collected.set(e.id, [...e.evidence]);

    await Promise.all(
      this.deps.evidenceSources
        .filter((s) => s.isAvailable(ctx))
        .map(async (source) => {
          const { independence, id } = source.descriptor;
          try {
            if (isBatchEvidenceSource(source)) {
              const outcome = await source.gatherMany(requests, ctx);
              issues.push(...outcome.issues);
              for (const [entityId, evidence] of outcome.byEntity) {
                const { evidence: clean } = enforceIndependence(evidence, independence);
                collected.get(entityId)?.push(...clean);
              }
              return;
            }
            const results = await Promise.all(
              requests.map(async (r) => ({ r, outcome: await source.gather(r, ctx) }))
            );
            for (const { r, outcome } of results) {
              issues.push(...outcome.issues);
              const { evidence: clean } = enforceIndependence(outcome.evidence, independence);
              collected.get(r.entityId)?.push(...clean);
            }
          } catch (err) {
            issues.push({
              stage: "gatherEvidence",
              code: "source_unavailable",
              detail: `Evidence source failed: ${err instanceof Error ? err.name : "unknown"}`,
              subject: id,
            });
          }
        })
    );

    for (const entity of entities) {
      // Deduplicate first. The entity repository already attaches stored
      // evidence, and an evidence source may return the SAME snapshot — without
      // this, one source counts twice and inflates review counts and source
      // diversity, which are ranking inputs.
      const raw = dedupeEvidence(collected.get(entity.id) ?? []);
      // Second guard: strip reputation from anything CLASSED official, whatever
      // adapter delivered it (see evidence/classes.ts).
      const { evidence: safe, stripped } = stripOfficialReputation(raw);
      if (stripped > 0) {
        issues.push({
          stage: "gatherEvidence",
          code: "validation_failed",
          detail: `Stripped ${stripped} reputation claim(s) from official-class evidence.`,
          subject: entity.id,
        });
      }

      if (safe.length === 0) {
        this.enrichment.enqueue(entity.id, "missing");
      } else if (safe.every((e) => isSourceStale(e.sourceType, e.retrievedAt, ctx.now))) {
        this.enrichment.enqueue(entity.id, "stale");
      }

      out.set(entity.id, { raw: safe, classified: classifyEvidence(safe, ctx.now) });
    }

    return out;
  }

  // ─── Projection ────────────────────────────────────────────────────────────

  private toRankedResult(
    item: {
      entity: Entity;
      evidence: ClassifiedEvidence;
      score: BroadScore;
      breakdown: ReturnType<typeof scoreCandidate>;
    },
    rank: number,
    categoryName: string,
    includeInternals: boolean
  ): RankedResult {
    const { entity, evidence, score, breakdown } = item;
    const strength = copy.evidenceStrength(evidence);

    const matched = breakdown.hardConstraints.filter((h) => h.passed && !h.unknown).map((h) => h.label);

    // The ranker's risk notes ("backed by a single independent source", "review
    // data is over a year old") are things the user should weigh, so they are
    // surfaced rather than left inside the score. Notes that merely restate a
    // coverage gap are dropped — evidenceGaps already says it better.
    const riskNotes = score.notes.filter(
      (n) => !n.startsWith("Missing:") && !/^No independent rating/.test(n)
    );

    const tradeoffs = [
      ...new Set([
        ...copy.evidenceGaps(evidence),
        ...breakdown.softPreferences.filter((p) => !p.satisfied).map((p) => `Doesn't match: ${p.label}`),
        ...evidence.reputation.commonComplaints.slice(0, 2).map((c) => `Reviewers mention ${c}`),
        ...riskNotes,
      ]),
    ];

    return {
      rank,
      entityId: entity.id,
      name: entity.canonicalName,
      url: entity.officialDomain || undefined,
      category: categoryName,
      shortReason: copy.shortReason({ rank, matchedConstraints: matched, evidence }),
      bestFor: copy.bestFor(evidence),
      keyAttributes: this.keyAttributes(evidence),
      reviewSummary: this.reviewSummary(evidence, entity.id),
      priceSummary: this.priceSummary(evidence),
      tradeoffs,
      sourceSummaries: this.sourceSummaries(entity),
      evidenceStrength: strength,
      freshness: copy.freshnessSummary(
        evidence.reputation.recencyDays ?? officialAgeDays(evidence, item.entity)
      ),
      // Scores are engineering detail — dev/admin only.
      ...(includeInternals ? { scoreBreakdown: breakdown } : {}),
    };
  }

  private keyAttributes(evidence: ClassifiedEvidence): RankedAttribute[] {
    const attrs: RankedAttribute[] = [];
    const { official } = evidence;
    const src = official.sourceUrls[0];

    if (official.platforms.length) {
      attrs.push({ label: "Platforms", value: official.platforms.join(", "), verified: true, sourceUrl: src });
    }
    if (official.pricing.hasFreePlan !== null) {
      attrs.push({
        label: "Free plan",
        value: official.pricing.hasFreePlan ? "Yes" : "No",
        verified: true,
        sourceUrl: src,
      });
    }
    if (official.features.length) {
      attrs.push({ label: "Features", value: official.features.slice(0, 4).join(", "), verified: true, sourceUrl: src });
    }
    if (official.location) {
      attrs.push({ label: "Location", value: official.location, verified: true, sourceUrl: src });
    }
    return attrs;
  }

  /** Present ONLY when independent evidence exists. Never built from official data. */
  private reviewSummary(evidence: ClassifiedEvidence, entityId: string): ReviewSummary | undefined {
    const rep = evidence.reputation;
    // No independent source → no review summary at all. An official-only result
    // must never render a rating widget.
    if (!evidence.hasIndependent) return undefined;

    const reputation = this.reputationFor(entityId);

    return {
      rating: rep.aggregateRating === null ? null : Math.round(rep.aggregateRating * 5 * 10) / 10,
      reviewCount: rep.reviewCount,
      recency:
        rep.recencyDays == null
          ? null
          : rep.recencyDays < 90
            ? "Reviews from the last few months"
            : rep.recencyDays < 365
              ? "Reviews from the last year"
              : "Reviews are over a year old",
      praise: rep.commonPraise.slice(0, 3),
      complaints: rep.commonComplaints.slice(0, 3),
      sourceCount: rep.sourceDiversity,
      sourcesDisagree: reputation?.reputation.sourcesDisagree ?? false,
      // Provider-mandated attribution travels with the data (Part 10).
      attributions: (reputation?.attributions ?? []).map((a) => ({
        provider: a.provider,
        providerName: a.providerName,
        providerLogoKey: a.providerLogoKey,
        sourceUrl: a.sourceUrl,
        rating: a.rating,
        ratingScale: a.ratingScale,
        reviewCount: a.reviewCount,
        retrievedAt: a.retrievedAt,
        requiredText: a.requiredText,
        requiresBacklink: a.requiresBacklink,
        requiresNewTab: a.requiresNewTab,
      })),
    };
  }

  /** Reputation detail from the review evidence source, when one is registered. */
  private reputationFor(entityId: string) {
    for (const source of this.deps.evidenceSources) {
      if (source instanceof ReviewEvidenceSource) return source.getResults().get(entityId);
    }
    return undefined;
  }

  private priceSummary(evidence: ClassifiedEvidence): PriceSummary | undefined {
    const p = evidence.official.pricing;
    const verified = p.monthly !== null || p.hasFreePlan !== null;
    if (!verified) {
      return {
        display: "Pricing could not be verified",
        monthlyFrom: null,
        hasFreePlan: null,
        hasFreeTrial: null,
        verified: false,
      };
    }
    const display =
      p.monthly !== null && p.monthly > 0
        ? `From $${p.monthly}/mo`
        : p.hasFreePlan
          ? "Free plan available"
          : "Paid — price not published";
    return {
      display,
      monthlyFrom: p.monthly,
      hasFreePlan: p.hasFreePlan,
      hasFreeTrial: p.hasFreeTrial,
      verified: true,
    };
  }

  private sourceSummaries(entity: Entity): SourceSummary[] {
    return entity.evidence.map((e) => ({
      label: e.sourceType,
      url: e.sourceUrl,
      kind: (["official", "pricing_page", "documentation"].includes(e.sourceType)
        ? "official"
        : ["trustpilot", "app_store"].includes(e.sourceType)
          ? "independent"
          : "editorial") as SourceSummary["kind"],
      retrievedAt: e.retrievedAt,
    }));
  }

  private buildCoverage(all: ClassifiedEvidence[]): EvidenceCoverage {
    const withIndependentReviews = all.filter((e) => e.hasIndependent).length;
    const withRatings = all.filter((e) => e.hasIndependentRating).length;
    const withVerifiedPricing = all.filter(
      (e) => e.official.pricing.monthly !== null || e.official.pricing.hasFreePlan !== null
    ).length;
    const sources = new Set<string>();
    for (const e of all) {
      for (const s of e.reputation.sourceTypes) sources.add(s);
      for (const s of e.editorial.sourceTypes) sources.add(s);
      if (e.official.sourceUrls.length) sources.add("official");
    }

    const gaps: string[] = [];
    if (all.length > 0 && withIndependentReviews === 0) {
      gaps.push("No independent review data was available for any option.");
    } else if (withIndependentReviews < all.length) {
      gaps.push(`${all.length - withIndependentReviews} of ${all.length} options have no independent reviews.`);
    }
    if (all.length > 0 && withVerifiedPricing < all.length) {
      gaps.push(`Pricing could not be verified for ${all.length - withVerifiedPricing} option(s).`);
    }

    return {
      withIndependentReviews,
      withRatings,
      withVerifiedPricing,
      distinctSources: sources.size,
      gaps,
    };
  }

  private agenticTrace() {
    for (const a of this.deps.discoveryAdapters) {
      if (a instanceof AgenticDiscoveryAdapter) return a.getTrace() ?? undefined;
    }
    return undefined;
  }

  private async loadCatalog(categoryId: string): Promise<Entity[]> {
    const page = await this.deps.repo.findCandidates({
      categoryId,
      requireCanonical: this.deps.requireCanonical ?? true,
    });
    return page.entities;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Collapse identical evidence records. Two records are the same observation
 * when they share a source type, URL, and retrieval time — which is exactly
 * what happens when the repository and an evidence source both read the same
 * stored snapshot.
 */
function dedupeEvidence(evidence: Entity["evidence"]): Entity["evidence"] {
  const seen = new Set<string>();
  const out: Entity["evidence"] = [];
  for (const e of evidence) {
    const key = `${e.sourceType}|${e.sourceUrl}|${e.retrievedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function officialAgeDays(evidence: ClassifiedEvidence, entity: Entity): number | null {
  const at = evidence.official.retrievedAt;
  if (!at) return null;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return null;
  void entity;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function optionsFor(ids: string[]): { id: string; label: string }[] {
  const byId = new Map(listCategories().map((c) => [c.id, c.name]));
  const chosen = ids.length > 0 ? ids : [...byId.keys()];
  return chosen.map((id) => ({ id, label: byId.get(id) ?? id }));
}

function logSearch(d: SearchDiagnostics, includeQuery: boolean): void {
  console.log(JSON.stringify(toLogLine(d, includeQuery)));
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

function randomId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `srch_${Date.now().toString(36)}`;
  } catch {
    return `srch_${Date.now().toString(36)}`;
  }
}

export { QUERY_CACHE };
