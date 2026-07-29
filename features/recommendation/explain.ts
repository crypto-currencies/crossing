/**
 * Explanation-input builder.
 *
 * Turns scored candidates into a constrained, fact-only payload a future LLM
 * can render into prose. Crucially, EVERY claim here is derived from evidence
 * or the deterministic breakdown — the generator is told (via `instruction`)
 * to add nothing else. This is what keeps explanations grounded: the LLM never
 * sees the raw query freedom to invent, only a list of verified statements.
 */

import type { Entity } from "./entities/types";
import type { ScoreBreakdown } from "./ranking/score";
import { normalizedRating } from "./evidence/types";
import type { ExplanationClaim, ExplanationInput, ExplanationSubject } from "./types";

const INSTRUCTION =
  "Write a short, neutral recommendation using ONLY the claims provided for each item. " +
  "Do not introduce any fact, number, feature, or comparison that is not present in the claims. " +
  "If a claim carries an evidenceUrl, you may attribute it. Prefer the best item, but mention a " +
  "relevant tradeoff honestly. Never invent ratings, prices, or capabilities.";

function ratingClaims(entity: Entity): ExplanationClaim[] {
  const claims: ExplanationClaim[] = [];
  for (const ev of entity.evidence) {
    const norm = normalizedRating(ev.rating, ev.ratingScale);
    if (norm === null || ev.reviewCount <= 0) continue;
    claims.push({
      kind: "rating",
      text: `${ev.sourceType} reports ${ev.rating}/${ev.ratingScale} across ${ev.reviewCount.toLocaleString()} reviews.`,
      evidenceUrl: ev.sourceUrl,
    });
  }
  return claims;
}

function attributeClaims(entity: Entity): ExplanationClaim[] {
  const claims: ExplanationClaim[] = [];
  const a = entity.attributes;
  if (a.hasFreePlan === true) claims.push({ kind: "attribute", text: `${entity.canonicalName} has a free plan.` });
  if (typeof a.priceMonthly === "number") claims.push({ kind: "attribute", text: `Paid plans start around $${a.priceMonthly}/month.` });
  if (a.openSource === true) claims.push({ kind: "attribute", text: `${entity.canonicalName} is open source.` });
  if (a.selfHostable === true) claims.push({ kind: "attribute", text: `${entity.canonicalName} can be self-hosted.` });
  if (typeof a.platforms === "string") claims.push({ kind: "attribute", text: `Available on: ${String(a.platforms).split(",").join(", ")}.` });
  return claims;
}

function breakdownClaims(breakdown: ScoreBreakdown): ExplanationClaim[] {
  const claims: ExplanationClaim[] = [];
  for (const c of breakdown.hardConstraints) {
    if (c.passed && !c.unknown) claims.push({ kind: "constraint", text: `Meets requirement: ${c.label}.` });
  }
  for (const w of breakdown.warnings) claims.push({ kind: "freshness", text: w });
  return claims;
}

function subjectFor(entity: Entity, breakdown: ScoreBreakdown): ExplanationSubject {
  return {
    name: entity.canonicalName,
    score: breakdown.total,
    // Order matters for readability: what it is → how it's rated → caveats.
    claims: [...attributeClaims(entity), ...ratingClaims(entity), ...breakdownClaims(breakdown)],
  };
}

export function buildExplanationInput(
  rawQuery: string,
  categoryName: string | null,
  best: { entity: Entity; breakdown: ScoreBreakdown } | null,
  alternatives: { entity: Entity; breakdown: ScoreBreakdown }[]
): ExplanationInput {
  return {
    query: rawQuery,
    categoryName,
    best: best ? subjectFor(best.entity, best.breakdown) : null,
    alternatives: alternatives.map((a) => subjectFor(a.entity, a.breakdown)),
    instruction: INSTRUCTION,
  };
}
