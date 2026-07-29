/**
 * The staged live-search orchestrator.
 *
 * Runs the nine stages in order, collecting every stage's issues and metrics
 * into one trace. Short-circuits early and TRUTHFULLY: an unsupported category
 * stops before discovery; an empty category stops before evidence gathering.
 *
 * This is deliberately a RUNNER, not a reasoner. It contains no judgment about
 * which product is better — that lives entirely in the pure `filter` and `rank`
 * stages. What it owns is sequencing, budgets, fault isolation, and honest
 * reporting of what the pipeline could and could not establish.
 *
 * See docs/live-search-architecture.md §2.
 */

import { listCategories } from "@/features/recommendation/categories/definitions";
import type { EntityRepository } from "@/features/entities/repository";
import {
  DEFAULT_DEADLINE_MS,
  MIN_RESULT_COUNT,
  SPARSE_THRESHOLD,
  nowMs,
  type CategorySuggestion,
  type CoverageReport,
  type RankedSearchResponse,
  type SearchContext,
  type SearchOrchestrator,
  type SearchRequestInput,
  type StageIssue,
  type StageMetrics,
  type StageTrace,
} from "./contracts";
import { ParseStage, ResolveStage, type AvailabilityProbe } from "./stages/interpret";
import { DiscoverStage, NormalizeStage, ResolveEntitiesStage } from "./stages/discovery";
import { GatherEvidenceStage } from "./stages/evidence";
import { FilterStage, RankStage } from "./stages/ranking";
import type { DiscoverySource, EvidenceSource } from "./sources/types";

export interface OrchestratorDeps {
  repo: EntityRepository;
  discoverySources: DiscoverySource[];
  evidenceSources: EvidenceSource[];
  /** Optional: reports how many entities a category holds, for §1.5 honesty. */
  availabilityProbe?: AvailabilityProbe;
  /** Injectable clock — the whole pipeline reads time from here. */
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  deadlineMs?: number;
  /**
   * Whether the catalog may only serve CANONICAL rows. Defaults to true, so a
   * misconfigured deployment fails closed and never ranks demo data. Tests and
   * local previews set it false to use the fixture corpus.
   */
  requireCanonical?: boolean;
}

export class StagedSearchOrchestrator implements SearchOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async search(input: SearchRequestInput): Promise<RankedSearchResponse> {
    const startedAt = nowMs();
    const env = this.deps.env ?? process.env;
    const ctx: SearchContext = {
      requestId: randomId(),
      now: this.deps.now?.() ?? new Date(),
      env,
      deadlineMs: this.deps.deadlineMs ?? DEFAULT_DEADLINE_MS,
      isDev: env.NODE_ENV !== "production",
    };

    const issues: StageIssue[] = [];
    const metrics: StageMetrics[] = [];
    let candidateSources: Record<string, number> = {};

    const finish = (): { requestId: string; timingMs: number; trace?: StageTrace } => ({
      requestId: ctx.requestId,
      timingMs: round(nowMs() - startedAt),
      // The full trace is a development affordance. Production responses carry
      // no internal pipeline detail.
      ...(ctx.isDev ? { trace: { metrics, issues, candidateSources } } : {}),
    });

    try {
      // ── 1. parse ──────────────────────────────────────────────────────────
      const parse = await new ParseStage().run(input, ctx);
      metrics.push(parse.metrics);
      issues.push(...parse.issues);
      const { parsed, targetCount } = parse.output;

      // ── 2. resolve ────────────────────────────────────────────────────────
      const resolve = await new ResolveStage(this.deps.availabilityProbe).run(parse.output, ctx);
      metrics.push(resolve.metrics);
      issues.push(...resolve.issues);
      const { resolution, categoryId, categoryName, availability } = resolve.output;

      if (resolution.status === "unsupported") {
        return {
          ...finish(),
          status: "unsupported-category",
          parsedQuery: parsed,
          category: resolution,
          message: unsupportedMessage(resolution.categoryLabel),
        };
      }

      if (resolution.status !== "supported" || !categoryId) {
        return {
          ...finish(),
          status: "needs-clarification",
          parsedQuery: parsed,
          category: resolution,
          suggestions: suggestionsFor(resolution.suggestedCategoryIds),
          message:
            resolution.status === "ambiguous"
              ? "We couldn't tell which category you meant. Pick the one you're after and we'll rank it."
              : "We couldn't match that to a supported category. Choose one to search within.",
        };
      }

      const name = categoryName ?? categoryId;

      // A recognized-but-empty category: stop here rather than running discovery,
      // evidence, and ranking over nothing (§1.5).
      if (availability && !availability.viable) {
        return {
          ...finish(),
          status: "no-results",
          parsedQuery: parsed,
          categoryId,
          categoryName: name,
          excluded: [],
          coverage: emptyCoverage(targetCount, [
            `Crossing doesn't cover any ${name.toLowerCase()} yet.`,
          ]),
          message: `We understood your request, but Crossing has no ${name.toLowerCase()} in its catalog yet.`,
        };
      }

      // ── 3. discover ───────────────────────────────────────────────────────
      const discover = await new DiscoverStage(this.deps.discoverySources).run(
        { categoryId, rawQuery: parsed.rawQuery, targetCount },
        ctx
      );
      metrics.push(discover.metrics);
      issues.push(...discover.issues);
      candidateSources = discover.output.bySource;

      // ── 4. normalize ──────────────────────────────────────────────────────
      const normalize = await new NormalizeStage().run(discover.output.leads, ctx);
      metrics.push(normalize.metrics);
      issues.push(...normalize.issues);

      // ── 5. resolveEntities ────────────────────────────────────────────────
      const resolved = await new ResolveEntitiesStage(
        this.deps.repo,
        this.deps.requireCanonical ?? true
      ).run({ candidates: normalize.output, categoryId }, ctx);
      metrics.push(resolved.metrics);
      issues.push(...resolved.issues);

      // ── 6. gatherEvidence ─────────────────────────────────────────────────
      const evidenced = await new GatherEvidenceStage(this.deps.evidenceSources).run(
        { candidates: resolved.output, categoryId },
        ctx
      );
      metrics.push(evidenced.metrics);
      issues.push(...evidenced.issues);

      // ── 7. filter ─────────────────────────────────────────────────────────
      const filtered = await new FilterStage().run(
        { candidates: evidenced.output, query: parsed, categoryId },
        ctx
      );
      metrics.push(filtered.metrics);
      issues.push(...filtered.issues);

      // ── 8. rank ───────────────────────────────────────────────────────────
      const ranked = await new RankStage().run({ ...filtered.output, targetCount }, ctx);
      metrics.push(ranked.metrics);
      issues.push(...ranked.issues);

      // ── 9. respond ────────────────────────────────────────────────────────
      const coverage = buildCoverageReport({
        discovered: discover.output.leads.length,
        resolved: resolved.output.length,
        candidates: evidenced.output,
        eligible: filtered.output.eligible.length,
        targetCount,
      });

      const results = ranked.output.results;
      const excluded = ranked.output.excluded;

      if (results.length === 0) {
        return {
          ...finish(),
          status: "no-results",
          parsedQuery: parsed,
          categoryId,
          categoryName: name,
          excluded,
          coverage,
          message:
            excluded.length > 0
              ? "We found options in that category, but none cleared every requirement you set. Try relaxing a constraint."
              : "No options matched that search. Try describing it a little differently, or drop a requirement.",
        };
      }

      const warnings = buildWarnings(coverage, results.length, targetCount);

      // `sparse` is an honest state, not a failure: real candidates, but too few
      // or too thinly evidenced to present as a survey of the market (§2.3).
      if (results.length < Math.min(SPARSE_THRESHOLD, targetCount)) {
        return {
          ...finish(),
          status: "sparse",
          parsedQuery: parsed,
          categoryId,
          categoryName: name,
          results,
          excluded,
          coverage,
          warnings,
          message: `Crossing only has ${results.length} ${name.toLowerCase()} matching this so far — this is not a complete picture of the market.`,
        };
      }

      return {
        ...finish(),
        status: "ranked",
        parsedQuery: parsed,
        categoryId,
        categoryName: name,
        results,
        excluded,
        coverage,
        warnings,
      };
    } catch (err) {
      // Log server-side; never leak internals to the client.
      console.error(`[search] ${ctx.requestId} failed:`, err);
      return {
        ...finish(),
        status: "error",
        code: "internal_error",
        message: "Something went wrong running that search. Please try again.",
      };
    }
  }
}

// ─── Reporting helpers ───────────────────────────────────────────────────────

function buildCoverageReport(input: {
  discovered: number;
  resolved: number;
  candidates: { coverage: { hasIndependent: boolean; hasRating: boolean } }[];
  eligible: number;
  targetCount: number;
}): CoverageReport {
  const withIndependentEvidence = input.candidates.filter((c) => c.coverage.hasIndependent).length;
  const withRating = input.candidates.filter((c) => c.coverage.hasRating).length;

  const gaps: string[] = [];
  if (input.resolved > 0 && withIndependentEvidence === 0) {
    gaps.push("No independent review evidence was available for any option.");
  } else if (withIndependentEvidence < input.resolved) {
    gaps.push(
      `${input.resolved - withIndependentEvidence} of ${input.resolved} options have no independent review evidence.`
    );
  }
  if (input.resolved > 0 && withRating === 0) {
    gaps.push("No option carries a source-attributed rating.");
  }
  if (input.eligible < input.targetCount) {
    gaps.push(`Found ${input.eligible} eligible options against a target of ${input.targetCount}.`);
  }

  return {
    discovered: input.discovered,
    resolved: input.resolved,
    eligible: input.eligible,
    withIndependentEvidence,
    withRating,
    targetCount: input.targetCount,
    gaps,
  };
}

function emptyCoverage(targetCount: number, gaps: string[]): CoverageReport {
  return {
    discovered: 0,
    resolved: 0,
    eligible: 0,
    withIndependentEvidence: 0,
    withRating: 0,
    targetCount,
    gaps,
  };
}

function buildWarnings(coverage: CoverageReport, resultCount: number, targetCount: number): string[] {
  const warnings: string[] = [];
  if (coverage.withIndependentEvidence === 0) {
    warnings.push("Ranking is based on vendor-published facts only — no independent reviews were available.");
  }
  if (resultCount < MIN_RESULT_COUNT && resultCount < targetCount) {
    warnings.push(`Only ${resultCount} options are covered here, not the full market.`);
  }
  return warnings;
}

function unsupportedMessage(label?: string): string {
  const what = label ? label.toLowerCase() : "that";
  return `Crossing understood your request, but ${what} isn't a category it covers yet. It only ranks online tools and software.`;
}

function suggestionsFor(ids: string[]): CategorySuggestion[] {
  const byId = new Map(listCategories().map((c) => [c.id, c.name]));
  const chosen = ids.length > 0 ? ids : [...byId.keys()];
  return chosen.map((id) => ({ id, label: byId.get(id) ?? id }));
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

function randomId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? fallbackId();
  } catch {
    return fallbackId();
  }
}

function fallbackId(): string {
  return `srch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
