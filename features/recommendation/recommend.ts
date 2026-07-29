/**
 * Recommendation orchestrator — the end-to-end Phase 1 pipeline:
 *
 *   raw query
 *     → parse (deterministic parser, validated)
 *     → resolve category
 *     → discover candidates (mock corpus)
 *     → resolve/dedup entities
 *     → score deterministically (hard-constraint gate first)
 *     → split eligible / ineligible, stable-sort eligible
 *     → assemble RecommendationResult + constrained explanation input
 *
 * No AI, no network, no DB. `now` is injectable for deterministic tests.
 */

import { getCategory } from "./categories/definitions";
import { resolveCategory, type CategoryResolution } from "./categories/resolve";
import { discoverCandidates } from "./candidates/discover";
import { resolveEntities } from "./entities/normalize";
import type { Entity } from "./entities/types";
import { normalizedRating } from "./evidence/types";
import { buildExplanationInput } from "./explain";
import { buildFixtures } from "./fixtures";
import { invariant } from "./invariant";
import { isEnabled } from "@/lib/server/feature-flags";
import { deterministicParser, parseQuerySafe, type QueryParser } from "./query/parser";
import { parsedQuerySchema, type ParsedQuery } from "./query/schema";
import { scoreCandidate, type ScoreBreakdown } from "./ranking/score";
import type {
  ConfidenceLevel,
  EvidenceRef,
  IneligibleItem,
  RecommendationResult,
  RecommendedItem,
} from "./types";

/**
 * Structured overrides applied AFTER parsing but BEFORE scoring. Lets a caller
 * pin a category, force a result count, or inject explicit constraints/
 * preferences on top of the parser's interpretation. Merged shallowly and
 * re-validated, so an override can never produce an invalid ParsedQuery.
 */
export type QueryOverrides = Partial<
  Pick<
    ParsedQuery,
    | "categoryId"
    | "hardConstraints"
    | "softPreferences"
    | "negativePreferences"
    | "budget"
    | "intendedAudience"
    | "requestedResultCount"
  >
>;

export interface RecommendOptions {
  parser?: QueryParser;
  /** Override the entity corpus (defaults to the mock fixtures). */
  corpus?: Entity[];
  now?: Date;
  /** Structured overrides merged onto the parsed query before scoring. */
  overrides?: QueryOverrides;
}

interface Scored {
  entity: Entity;
  breakdown: ScoreBreakdown;
}

/** Deterministic, stable comparator. Ties never reshuffle between runs. */
function compareScored(a: Scored, b: Scored): number {
  if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total;
  if (b.breakdown.components.reviewConfidence !== a.breakdown.components.reviewConfidence) {
    return b.breakdown.components.reviewConfidence - a.breakdown.components.reviewConfidence;
  }
  if (b.breakdown.components.generalQuality !== a.breakdown.components.generalQuality) {
    return b.breakdown.components.generalQuality - a.breakdown.components.generalQuality;
  }
  return a.entity.id.localeCompare(b.entity.id);
}

function evidenceRefs(entity: Entity): EvidenceRef[] {
  return entity.evidence.map((e) => ({
    sourceType: e.sourceType,
    sourceUrl: e.sourceUrl,
    retrievedAt: e.retrievedAt,
    rating: e.rating,
    ratingScale: e.ratingScale,
    reviewCount: e.reviewCount,
  }));
}

function toItem(scored: Scored): RecommendedItem {
  const { entity, breakdown } = scored;

  const matchedConstraints = breakdown.hardConstraints.filter((c) => c.passed && !c.unknown).map((c) => c.label);
  const unmetPreferences = breakdown.softPreferences.filter((p) => !p.satisfied).map((p) => p.label);
  const matchedDislikes = breakdown.negativePreferences.filter((p) => p.satisfied).map((p) => p.label);

  const tradeoffs = [
    ...breakdown.warnings,
    ...unmetPreferences.map((p) => `Doesn't match preference: ${p}`),
    ...matchedDislikes.map((d) => `Includes something you wanted to avoid: ${d}`),
  ];

  return {
    entityId: entity.id,
    name: entity.canonicalName,
    domain: entity.officialDomain,
    categoryId: entity.categoryId,
    score: breakdown.total,
    breakdown,
    matchedConstraints,
    unmetPreferences,
    tradeoffs,
    evidenceRefs: evidenceRefs(entity),
    freshnessWarnings: breakdown.warnings.filter((w) => /older|stale|fresh/i.test(w)),
  };
}

function levelFor(confidence: number): ConfidenceLevel {
  if (confidence >= 0.66) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

/**
 * Overall result confidence blends: how sure the parser was, how strong the top
 * score is, and how clear the margin over the runner-up is. Deterministic.
 */
function overallConfidence(parsed: ParsedQuery, ranked: Scored[]): number {
  if (ranked.length === 0) return 0;
  const best = ranked[0].breakdown.total;
  const margin = ranked.length > 1 ? best - ranked[1].breakdown.total : best;
  const blended = 0.45 * parsed.confidence + 0.4 * best + 0.15 * Math.min(margin * 2, 1);
  return Math.min(Math.max(blended, 0), 1);
}

/** Merge structured overrides onto a parsed query and re-validate. */
function applyOverrides(parsed: ParsedQuery, overrides?: QueryOverrides): ParsedQuery {
  if (!overrides || Object.keys(overrides).length === 0) return parsed;
  return parsedQuerySchema.parse({ ...parsed, ...overrides });
}

/**
 * Build the short-circuit result returned whenever the category gate does NOT
 * resolve a supported category. Nothing is retrieved or ranked: no winner, no
 * alternatives, no ineligible list of unrelated entities. This is what makes an
 * unsupported ("coffee shop"), ambiguous, or unknown query fail *truthfully*.
 */
function unresolvedResult(
  parsed: ParsedQuery,
  resolution: CategoryResolution,
  now: Date
): RecommendationResult {
  const categoryName = resolution.categoryLabel ?? null;
  return {
    query: { ...parsed, categoryId: resolution.categoryId },
    resolution,
    categoryId: resolution.categoryId,
    categoryName,
    best: null,
    alternatives: [],
    ineligible: [],
    confidence: 0,
    confidenceLevel: "low",
    generatedAt: now.toISOString(),
    explanationInput: buildExplanationInput(parsed.rawQuery, categoryName, null, []),
    diagnostics: {
      resolvedDomain: resolution.domain,
      resolvedCategoryId: resolution.categoryId,
      resolutionStatus: resolution.status,
      confidence: resolution.confidence,
      candidateCount: 0,
      candidateCategoryIds: [],
      rankingInvoked: false,
    },
  };
}

export async function runRecommendation(
  rawQuery: string,
  options: RecommendOptions = {}
): Promise<RecommendationResult> {
  const now = options.now ?? new Date();
  const parser = options.parser ?? deterministicParser;
  let corpus = options.corpus ?? buildFixtures(now);

  // OPT-IN: overlay stored official-site evidence onto the seeded corpus, gated by
  // explicit category/entity allow-lists AND per-entity readiness. Reads the
  // snapshot store only (never crawls). Skipped entirely when no merge scope is
  // configured or when a corpus is injected, so validated seeded behavior is
  // unchanged and the default (and every existing test) never touches ingestion.
  let evidenceMode: "seeded" | "mixed" | "live" | undefined;
  if (!options.corpus) {
    try {
      const { anyMergeConfigured } = await import("@/features/ingestion/config");
      if (anyMergeConfigured()) {
        const { applyConfiguredMerge } = await import("@/features/ingestion/enrich");
        const { getDefaultSnapshotStore } = await import("@/features/ingestion/store");
        const enriched = await applyConfiguredMerge(corpus, getDefaultSnapshotStore(), process.env, now);
        corpus = enriched.corpus;
        evidenceMode = enriched.evidenceMode;
      }
    } catch {
      // Enrichment is best-effort; fall back to the seeded corpus on any error.
      evidenceMode = "seeded";
    }
  }

  const rawParsed = await parseQuerySafe(parser, rawQuery);
  const parsed = applyOverrides(rawParsed, options.overrides);

  // ── The gate ───────────────────────────────────────────────────────────────
  // Resolve a category BEFORE any retrieval. An explicit user selection (via
  // overrides.categoryId) takes precedence; otherwise we resolve from the query
  // text. Anything that isn't a confidently-supported category stops here.
  const resolution = resolveCategory(parsed.rawQuery, options.overrides?.categoryId ?? null);
  if (resolution.status !== "supported") {
    return unresolvedResult(parsed, resolution, now);
  }

  // Past the gate: a supported category id is guaranteed.
  invariant(resolution.categoryId !== null, "supported resolution must carry a categoryId");
  const categoryId = resolution.categoryId;
  const category = getCategory(categoryId);
  invariant(category, `resolved supported category "${categoryId}" has no definition`);
  const categoryName = category.name;

  // Pin the parsed query's category to the resolved one so the echoed
  // interpretation and the scored candidates can never disagree.
  const gatedQuery: ParsedQuery = { ...parsed, categoryId };

  // Candidate source: the DB-backed repository behind FEATURE_DB_ENTITIES, or the
  // demo fixture corpus otherwise. A caller-injected corpus (tests, previews)
  // always wins — it must never be silently swapped for live DB data.
  const useDbEntities = !options.corpus && isEnabled("FEATURE_DB_ENTITIES");
  const candidateSource: "fixture" | "db" = useDbEntities ? "db" : "fixture";

  let rawCandidates: Entity[];
  if (useDbEntities) {
    // Dynamic import: keeps @/lib/db (Prisma) out of every hermetic test that
    // never enables the flag, matching the ingestion-merge import pattern above.
    const { getDefaultEntityRepository } = await import("@/features/entities/default-repository");
    const repo = getDefaultEntityRepository();
    // requireCanonical: only ACTIVE + CANONICAL rows — no fictional/demo leakage
    // and no draft/hidden/archived entity can ever be ranked in production.
    const page = await repo.findCandidates({ categoryId, requireCanonical: true });
    rawCandidates = page.entities;
  } else {
    rawCandidates = discoverCandidates(categoryId, corpus);
  }

  const candidates = resolveEntities(rawCandidates);
  // Defense-in-depth: retrieval must never leak an entity from another category,
  // regardless of which source produced the candidates.
  invariant(
    candidates.every((e) => e.categoryId === categoryId),
    `candidate retrieval (${candidateSource}) returned an entity outside category "${categoryId}"`
  );

  const scored: Scored[] = candidates.map((entity) => ({
    entity,
    breakdown: scoreCandidate(entity, gatedQuery, category, now),
  }));

  const eligible = scored.filter((s) => s.breakdown.eligible).sort(compareScored);
  const ineligible: IneligibleItem[] = scored
    .filter((s) => !s.breakdown.eligible)
    .map((s) => ({ entityId: s.entity.id, name: s.entity.canonicalName, reasons: s.breakdown.ineligibleReasons }));

  const wanted = gatedQuery.requestedResultCount;
  const best = eligible[0] ?? null;
  const alternatives = eligible.slice(1, Math.max(wanted, 3)); // always offer ≥2 alternatives when available

  const confidence = overallConfidence(gatedQuery, eligible);

  const explanationInput = buildExplanationInput(
    gatedQuery.rawQuery,
    categoryName,
    best ? { entity: best.entity, breakdown: best.breakdown } : null,
    alternatives.map((a) => ({ entity: a.entity, breakdown: a.breakdown }))
  );

  return {
    query: gatedQuery,
    resolution,
    categoryId,
    categoryName,
    best: best ? toItem(best) : null,
    alternatives: alternatives.map((a) => toItem(a)),
    ineligible,
    confidence,
    confidenceLevel: levelFor(confidence),
    generatedAt: now.toISOString(),
    explanationInput,
    diagnostics: {
      resolvedDomain: resolution.domain,
      resolvedCategoryId: categoryId,
      resolutionStatus: resolution.status,
      confidence: resolution.confidence,
      candidateCount: candidates.length,
      candidateCategoryIds: [...new Set(candidates.map((c) => c.categoryId))],
      rankingInvoked: true,
      ...(evidenceMode ? { evidenceMode } : {}),
      candidateSource,
    },
  };
}

/** Re-export the freshest-rating helper for callers that want a quick headline number. */
export function headlineRating(entity: Entity): number | null {
  let bestNorm: number | null = null;
  for (const ev of entity.evidence) {
    const norm = normalizedRating(ev.rating, ev.ratingScale);
    if (norm !== null && (bestNorm === null || ev.reviewCount > 0)) bestNorm = norm;
  }
  return bestNorm;
}
