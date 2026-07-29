/**
 * Stage 6: `gatherEvidence`.
 *
 * This stage carries the structural fix for the audit's most important finding
 * (docs/live-search-architecture.md §1.9). Two rules are enforced HERE, once,
 * rather than being left to each adapter's good behavior:
 *
 *   1. A `vendor` source can never contribute a rating, review count, or review
 *      topic. `enforceIndependence` strips them unconditionally.
 *   2. Every candidate gets an explicit `EvidenceCoverage` describing what was
 *      actually found — including what was NOT. A missing rating stays missing;
 *      no default, no placeholder, no category-average stand-in presented as if
 *      it were measured.
 *
 * Rule 2 is what lets the UI say "no independent reviews found" instead of
 * rendering an empty five-star row, and what lets the response report an honest
 * `sparse` state.
 */

import type { Evidence } from "@/features/recommendation/evidence/types";
import { evidenceAgeDays } from "@/features/recommendation/evidence/types";
import { getCategory } from "@/features/recommendation/categories/definitions";
import {
  issue,
  nowMs,
  type EvidenceCoverage,
  type EvidencedCandidate,
  type ResolvedCandidate,
  type SearchContext,
  type Stage,
  type StageIssue,
  type StageResult,
} from "../contracts";
import {
  enforceIndependence,
  isBatchEvidenceSource,
  isReputationBearing,
  type EvidenceRequest,
  type EvidenceSource,
} from "../sources/types";

export interface GatherEvidenceInput {
  candidates: ResolvedCandidate[];
  categoryId: string;
}

/** Attributes we always try to resolve; absence is reported, never filled. */
const EXPECTED_ATTRIBUTES = ["priceMonthly", "hasFreePlan", "platforms"] as const;

export class GatherEvidenceStage implements Stage<GatherEvidenceInput, EvidencedCandidate[]> {
  readonly name = "gatherEvidence" as const;

  constructor(private readonly sources: EvidenceSource[]) {}

  async run(input: GatherEvidenceInput, ctx: SearchContext): Promise<StageResult<EvidencedCandidate[]>> {
    const started = nowMs();
    const issues: StageIssue[] = [];
    let externalCalls = 0;

    const requests: EvidenceRequest[] = input.candidates.map((c) => ({
      entityId: c.entity.id,
      entityName: c.entity.canonicalName,
      domainKey: c.entity.domainKey,
      categoryId: input.categoryId,
    }));

    // Accumulated evidence per entity, tagged with the independence of whatever
    // produced it — the tag is what the ranking stage trusts, not the payload.
    const gathered = new Map<string, { evidence: Evidence; reputationBearing: boolean }[]>();
    for (const r of requests) gathered.set(r.entityId, []);

    const available = this.sources.filter((s) => s.isAvailable(ctx));
    if (available.length === 0) {
      issues.push(issue("gatherEvidence", "source_unavailable", "No evidence source is configured."));
    }

    // Sources run in parallel; each is fault-isolated.
    await Promise.all(
      available.map(async (source) => {
        const { independence, id } = source.descriptor;
        const bearing = isReputationBearing(independence);

        try {
          if (isBatchEvidenceSource(source)) {
            const outcome = await source.gatherMany(requests, ctx);
            externalCalls += outcome.externalCalls;
            issues.push(...outcome.issues);
            for (const [entityId, evidence] of outcome.byEntity) {
              const { evidence: clean, stripped } = enforceIndependence(evidence, independence);
              if (stripped > 0) {
                issues.push(
                  issue(
                    "gatherEvidence",
                    "validation_failed",
                    `Stripped ${stripped} quality claim(s) from vendor source "${id}" — vendors may assert facts, not ratings.`,
                    entityId
                  )
                );
              }
              const bucket = gathered.get(entityId);
              if (bucket) bucket.push(...clean.map((e) => ({ evidence: e, reputationBearing: bearing })));
            }
            return;
          }

          // Per-entity source: still parallel, but one call per candidate.
          const results = await Promise.all(
            requests.map(async (r) => ({ r, outcome: await source.gather(r, ctx) }))
          );
          for (const { r, outcome } of results) {
            externalCalls += outcome.externalCalls;
            issues.push(...outcome.issues);
            const { evidence: clean, stripped } = enforceIndependence(outcome.evidence, independence);
            if (stripped > 0) {
              issues.push(
                issue(
                  "gatherEvidence",
                  "validation_failed",
                  `Stripped ${stripped} quality claim(s) from vendor source "${id}".`,
                  r.entityId
                )
              );
            }
            const bucket = gathered.get(r.entityId);
            if (bucket) bucket.push(...clean.map((e) => ({ evidence: e, reputationBearing: bearing })));
          }
        } catch (err) {
          issues.push(
            issue(
              "gatherEvidence",
              "source_unavailable",
              `Evidence source threw: ${err instanceof Error ? err.name : "unknown error"}`,
              id
            )
          );
        }
      })
    );

    const out: EvidencedCandidate[] = input.candidates.map((c) => {
      const entries = gathered.get(c.entity.id) ?? [];
      // Evidence already attached to the catalog entity counts as vendor-neutral
      // factual data; source-supplied evidence is layered on top.
      const evidence = [...c.entity.evidence, ...entries.map((e) => e.evidence)];
      const coverage = buildCoverage(
        evidence,
        entries.some((e) => e.reputationBearing && hasQualitySignal(e.evidence)),
        input.categoryId,
        ctx.now
      );

      if (!coverage.hasIndependent) {
        issues.push(
          issue(
            "gatherEvidence",
            "field_absent",
            "No independent review evidence — quality cannot be assessed from vendor material alone.",
            c.entity.id
          )
        );
      }

      return { ...c, entity: { ...c.entity, evidence }, coverage };
    });

    return {
      output: out,
      issues,
      metrics: {
        stage: this.name,
        durationMs: round(nowMs() - started),
        itemsIn: input.candidates.length,
        itemsOut: out.length,
        externalCalls,
      },
    };
  }
}

/** True when this evidence actually carries a reputation signal (not just facts). */
function hasQualitySignal(e: Evidence): boolean {
  return e.rating != null || e.reviewCount > 0 || (e.reviewTopics?.length ?? 0) > 0;
}

/**
 * Describe what evidence a candidate has — and, critically, what it lacks.
 * Every field here is derived from evidence actually present; nothing is
 * defaulted to make the record look complete.
 */
export function buildCoverage(
  evidence: Evidence[],
  hasIndependent: boolean,
  categoryId: string,
  now: Date
): EvidenceCoverage {
  const sourceTypes = [...new Set(evidence.map((e) => e.sourceType))].sort();
  const hasRating = evidence.some((e) => e.rating != null);

  const known = new Set<string>();
  for (const e of evidence) for (const k of Object.keys(e.attributes)) known.add(k);

  const category = getCategory(categoryId);
  const expected = category
    ? category.attributes.filter((a) => a.hardFilterable).map((a) => a.key)
    : [...EXPECTED_ATTRIBUTES];
  const missingAttributes = expected.filter((k) => !known.has(k)).sort();

  const ages = evidence.map((e) => evidenceAgeDays(e, now)).filter((a) => Number.isFinite(a));

  return {
    hasFactual: known.size > 0,
    hasIndependent,
    hasRating,
    sourceTypes,
    missingAttributes,
    freshestAgeDays: ages.length ? Math.min(...ages) : null,
  };
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
