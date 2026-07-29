/**
 * Stages 7–8: `filter` and `rank`.
 *
 * Both are PURE and CODE-DRIVEN. No model participates in eligibility or
 * ordering — same inputs always produce the same ranked list. This is the
 * property the audit's §2.1 principle 2 preserves from the existing engine, and
 * it is why these two stages reuse `scoreCandidate` unchanged.
 *
 * What differs from the old orchestrator is the OUTPUT SHAPE: a ranked list of
 * 10–20, not `best` plus two `alternatives` (§1.6). There is no "winner" flag —
 * position in the list is the entire ranking statement.
 */

import { getCategory } from "@/features/recommendation/categories/definitions";
import { scoreCandidate, type ScoreBreakdown } from "@/features/recommendation/ranking/score";
import type { ParsedQuery } from "@/features/recommendation/query/schema";
import type { Entity } from "@/features/recommendation/entities/types";
import {
  MAX_RANKED_RESULTS,
  issue,
  nowMs,
  pureResult,
  type EvidencedCandidate,
  type ExcludedResult,
  type FilteredCandidate,
  type RankedResult,
  type SearchContext,
  type Stage,
  type StageIssue,
  type StageResult,
} from "../contracts";

// ─── Stage 7: filter ─────────────────────────────────────────────────────────

export interface FilterInput {
  candidates: EvidencedCandidate[];
  query: ParsedQuery;
  categoryId: string;
}

export interface FilterOutput {
  eligible: FilteredCandidate[];
  ineligible: FilteredCandidate[];
  /** Score breakdowns, keyed by entity id, so `rank` never rescores. */
  breakdowns: Map<string, ScoreBreakdown>;
}

/**
 * Apply hard constraints. Ineligible candidates are KEPT (with reasons) rather
 * than silently dropped, so the response can show what was excluded and why —
 * "3 options excluded: over budget" is more useful than a shorter list.
 */
export class FilterStage implements Stage<FilterInput, FilterOutput> {
  readonly name = "filter" as const;

  async run(input: FilterInput, ctx: SearchContext): Promise<StageResult<FilterOutput>> {
    const started = nowMs();
    const issues: StageIssue[] = [];

    const category = getCategory(input.categoryId);
    if (!category) {
      return pureResult(
        this.name,
        { eligible: [], ineligible: [], breakdowns: new Map() },
        started,
        { in: input.candidates.length, out: 0 },
        [issue("filter", "validation_failed", `Unknown category "${input.categoryId}".`)]
      );
    }

    const breakdowns = new Map<string, ScoreBreakdown>();
    const eligible: FilteredCandidate[] = [];
    const ineligible: FilteredCandidate[] = [];

    for (const c of input.candidates) {
      const breakdown = scoreCandidate(c.entity, input.query, category, ctx.now);
      breakdowns.set(c.entity.id, breakdown);

      const filtered: FilteredCandidate = {
        ...c,
        eligible: breakdown.eligible,
        ineligibleReasons: breakdown.ineligibleReasons,
      };

      if (breakdown.eligible) eligible.push(filtered);
      else ineligible.push(filtered);
    }

    // An unverifiable constraint is a data gap, not a product verdict — surface
    // it so "we couldn't check the price" never reads as "it's too expensive".
    for (const c of ineligible) {
      const unverifiable = breakdowns.get(c.entity.id)?.hardConstraints.filter((h) => h.unknown && !h.passed) ?? [];
      for (const u of unverifiable) {
        issues.push(
          issue(
            "filter",
            "field_absent",
            `Excluded "${c.entity.canonicalName}" on "${u.label}" because ${u.attribute} is unknown, not because it failed.`,
            c.entity.id
          )
        );
      }
    }

    return pureResult(
      this.name,
      { eligible, ineligible, breakdowns },
      started,
      { in: input.candidates.length, out: eligible.length },
      issues
    );
  }
}

// ─── Stage 8: rank ───────────────────────────────────────────────────────────

export interface RankInput extends FilterOutput {
  targetCount: number;
}

export interface RankOutput {
  results: RankedResult[];
  excluded: ExcludedResult[];
}

/**
 * Deterministic, stable comparator. Ties break on review confidence, then
 * general quality, then entity id — so an identical query always produces an
 * identical list, which is what makes the pipeline testable.
 */
function compare(a: ScoreBreakdown, b: ScoreBreakdown, aId: string, bId: string): number {
  if (b.total !== a.total) return b.total - a.total;
  if (b.components.reviewConfidence !== a.components.reviewConfidence) {
    return b.components.reviewConfidence - a.components.reviewConfidence;
  }
  if (b.components.generalQuality !== a.components.generalQuality) {
    return b.components.generalQuality - a.components.generalQuality;
  }
  return aId.localeCompare(bId);
}

export class RankStage implements Stage<RankInput, RankOutput> {
  readonly name = "rank" as const;

  async run(input: RankInput, ctx: SearchContext): Promise<StageResult<RankOutput>> {
    const started = nowMs();

    const sorted = [...input.eligible].sort((x, y) =>
      compare(
        input.breakdowns.get(x.entity.id)!,
        input.breakdowns.get(y.entity.id)!,
        x.entity.id,
        y.entity.id
      )
    );

    const limit = Math.min(input.targetCount, MAX_RANKED_RESULTS);
    const results: RankedResult[] = sorted.slice(0, limit).map((c, i) => {
      const breakdown = input.breakdowns.get(c.entity.id)!;
      return toRankedResult(c, breakdown, i + 1);
    });

    const excluded: ExcludedResult[] = input.ineligible.map((c) => ({
      entityId: c.entity.id,
      name: c.entity.canonicalName,
      reasons: c.ineligibleReasons,
    }));

    void ctx;
    return pureResult(
      this.name,
      { results, excluded },
      started,
      { in: input.eligible.length, out: results.length }
    );
  }
}

function toRankedResult(c: FilteredCandidate, breakdown: ScoreBreakdown, rank: number): RankedResult {
  const matchedConstraints = breakdown.hardConstraints.filter((h) => h.passed && !h.unknown).map((h) => h.label);
  const unmetPreferences = breakdown.softPreferences.filter((p) => !p.satisfied).map((p) => p.label);
  const matchedDislikes = breakdown.negativePreferences.filter((p) => p.satisfied).map((p) => p.label);

  const tradeoffs = [
    ...breakdown.warnings,
    ...unmetPreferences.map((p) => `Doesn't match preference: ${p}`),
    ...matchedDislikes.map((d) => `Includes something you wanted to avoid: ${d}`),
    // The coverage gap is a tradeoff the user should weigh, stated plainly.
    ...(c.coverage.hasIndependent ? [] : ["No independent reviews found — facts are from the vendor's own site."]),
  ];

  return {
    rank,
    entityId: c.entity.id,
    name: c.entity.canonicalName,
    domain: c.entity.officialDomain,
    categoryId: c.entity.categoryId,
    description: c.entity.description,
    score: breakdown.total,
    breakdown,
    matchedConstraints,
    unmetPreferences,
    tradeoffs,
    evidenceRefs: evidenceRefsOf(c.entity),
    coverage: c.coverage,
  };
}

function evidenceRefsOf(entity: Entity) {
  return entity.evidence.map((e) => ({
    sourceType: e.sourceType,
    sourceUrl: e.sourceUrl,
    retrievedAt: e.retrievedAt,
    rating: e.rating,
    ratingScale: e.ratingScale,
    reviewCount: e.reviewCount,
  }));
}
