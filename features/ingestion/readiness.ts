/**
 * Deterministic readiness verdict for moving an entity from seeded to official
 * factual evidence. Purely rule-based over the latest snapshot + seed/official
 * merge — never "ready just because a request succeeded".
 */

import type { ApprovedEntitySource } from "./registry";
import type { EvidenceSnapshot } from "./snapshot";
import type { MergeResult } from "./merge";
import { MIN_OVERLAY_CONFIDENCE } from "./merge";
import { RANKING_FACTUAL_ATTRIBUTES } from "./evidence";

export type ReadinessVerdict =
  | "not-ingested"
  | "ingestion-failed"
  | "stale"
  | "blocked-by-conflict"
  | "needs-review"
  | "mixed"
  | "ready";

export interface ReadinessResult {
  verdict: ReadinessVerdict;
  reasons: string[];
  /** True only for the "ready" verdict — safe to promote factual attributes. */
  promotable: boolean;
}

export interface ReadinessInput {
  source: ApprovedEntitySource | null;
  latest: EvidenceSnapshot | null;
  latestValid: EvidenceSnapshot | null;
  merge: MergeResult;
}

export function assessReadiness({ source, latest, latestValid, merge }: ReadinessInput): ReadinessResult {
  const reasons: string[] = [];
  const done = (verdict: ReadinessVerdict): ReadinessResult => ({ verdict, reasons, promotable: verdict === "ready" });

  if (!latest && !latestValid) {
    reasons.push("No ingestion has run for this entity.");
    return done("not-ingested");
  }
  if (!latestValid) {
    reasons.push(`Latest ingestion failed${latest?.error ? ` (${latest.error.kind})` : ""}; no valid snapshot exists.`);
    return done("ingestion-failed");
  }

  // At least one official source URL must have succeeded.
  if (latestValid.http.pagesFetched < 1) {
    reasons.push("No official source URL was fetched successfully.");
    return done("ingestion-failed");
  }

  if (latestValid.freshnessStatus === "stale") {
    reasons.push("Latest valid snapshot is stale.");
    return done("stale");
  }

  // Category must match the entity's approved category.
  if (source && merge.entity.categoryId !== source.categoryId) {
    reasons.push("Category mismatch between entity and approved source.");
    return done("blocked-by-conflict");
  }

  // A conflict the merge did NOT resolve to official (kept seed) is blocking.
  const unresolved = merge.conflicts.filter((c) => c.resolution === "seed");
  if (unresolved.length > 0) {
    reasons.push(`Unresolved conflict on: ${unresolved.map((c) => c.attribute).join(", ")}.`);
    return done("blocked-by-conflict");
  }

  // Any official-backed ranking attribute below the confidence threshold needs review.
  const lowConf = latestValid.provenance.filter(
    (p) => (RANKING_FACTUAL_ATTRIBUTES as readonly string[]).includes(p.attribute) && p.confidence < MIN_OVERLAY_CONFIDENCE
  );
  if (lowConf.length > 0) {
    reasons.push(`Low extraction confidence on: ${lowConf.map((p) => p.attribute).join(", ")}.`);
    return done("needs-review");
  }

  // Pricing must be confidently known OR explicitly unknown — both acceptable.
  if (latestValid.pricing.kind === "unknown") reasons.push("Pricing is explicitly unknown (acceptable).");

  // Coverage is assessed over the FULL ranking-attribute set (not just those the
  // seed happened to define) so an empty-seed pilot can't be "ready" trivially.
  const covered = (RANKING_FACTUAL_ATTRIBUTES as readonly string[]).filter((k) => {
    const p = latestValid.provenance.find((pp) => pp.attribute === k);
    return !!p && p.confidence >= MIN_OVERLAY_CONFIDENCE;
  });
  if (covered.length === 0) {
    reasons.push("No official factual attributes were extracted yet.");
    return done("mixed");
  }

  // Ready requires a concrete platform fact AND a pricing fact (price or free-plan).
  // A free tool needs no priceMonthly; hasFreePlan satisfies the pricing side.
  const hasPlatforms = covered.includes("platforms");
  const hasPricingFact = covered.includes("priceMonthly") || covered.includes("hasFreePlan");
  if (hasPlatforms && hasPricingFact) {
    reasons.push(`Official evidence covers required factual fields: ${covered.join(", ")}.`);
    return done("ready");
  }

  reasons.push(`Partial official coverage (${covered.join(", ") || "none"}); missing a required factual field.`);
  return done("mixed");
}
