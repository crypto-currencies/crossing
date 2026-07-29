/**
 * Deterministic candidate scoring.
 *
 * CODE decides the ranking here — never an LLM. `scoreCandidate` is a pure
 * function: same (entity, query, category, now) always yields the same
 * breakdown. Hard constraints are evaluated BEFORE scoring; a candidate that
 * fails a required constraint is marked ineligible (kept, not silently
 * dropped) so callers can show it grayed-out with a reason.
 *
 * Every component is in 0..1. The total is a weight-normalized sum of the
 * positive components minus a risk penalty, clamped to 0..1.
 */

import type { CategoryDefinition } from "../categories/definitions";
import type { Entity } from "../entities/types";
import { evidenceAgeDays, normalizedRating } from "../evidence/types";
import { bayesianRating } from "../evidence/bayesian";
import type { ParsedQuery, QueryConstraint, QueryPreference } from "../query/schema";
import { SOURCE_DIVERSITY_TARGET, type RankingWeights } from "./config";

type AttrValue = string | number | boolean;

export interface ConstraintCheck {
  label: string;
  attribute: string;
  passed: boolean;
  /** True when the candidate simply lacks the attribute we needed to check. */
  unknown: boolean;
}

export interface PreferenceCheck {
  label: string;
  attribute: string;
  satisfied: boolean;
}

export interface ScoreComponents {
  constraintFit: number;
  queryRelevance: number;
  semanticRelevance: number;
  generalQuality: number;
  reviewConfidence: number;
  topicSentiment: number;
  sourceDiversity: number;
  freshness: number;
  /** Risk LEVEL, 0 (safe) .. 1 (very risky). Applied as a penalty on the total. */
  riskPenalty: number;
}

export interface ScoreBreakdown {
  entityId: string;
  eligible: boolean;
  ineligibleReasons: string[];
  hardConstraints: ConstraintCheck[];
  softPreferences: PreferenceCheck[];
  negativePreferences: PreferenceCheck[];
  components: ScoreComponents;
  weights: RankingWeights;
  /** Weight-normalized sum of the eight positive components (0..1). */
  positiveScore: number;
  /** weights.riskPenalty × riskLevel — subtracted from positiveScore. */
  penalty: number;
  /** Final score, 0..1. Ineligible candidates score 0. */
  total: number;
  /** Freshness/quality caveats surfaced to the explanation layer. */
  warnings: string[];
}

// ─── Attribute resolution ────────────────────────────────────────────────────

/**
 * Resolve an attribute for an entity: the entity's own canonical attributes
 * take precedence; evidence fills gaps. Returns undefined when nothing asserts it.
 */
function resolveAttribute(entity: Entity, key: string): AttrValue | undefined {
  if (key in entity.attributes) return entity.attributes[key];
  for (const ev of entity.evidence) {
    if (key in ev.attributes) return ev.attributes[key];
  }
  return undefined;
}

/** Treat a comma-joined string as a set (for enum/multi attributes like platforms). */
function asSet(value: AttrValue): Set<string> {
  return new Set(
    String(value)
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function compareOperator(actual: AttrValue, operator: string, expected: AttrValue): boolean {
  switch (operator) {
    case "exists":
      return true; // resolved to a value → it exists
    case "eq":
      return String(actual).toLowerCase() === String(expected).toLowerCase() || actual === expected;
    case "neq":
      return !(String(actual).toLowerCase() === String(expected).toLowerCase() || actual === expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "includes":
      return asSet(actual).has(String(expected).toLowerCase());
    case "excludes":
      return !asSet(actual).has(String(expected).toLowerCase());
    default:
      return false;
  }
}

// ─── Hard constraints (eligibility gate) ─────────────────────────────────────

function evaluateHardConstraints(entity: Entity, query: ParsedQuery): ConstraintCheck[] {
  const checks: ConstraintCheck[] = query.hardConstraints.map((c) => evalConstraint(entity, c));

  // Budget is a hard constraint on priceMonthly, expressed separately in ParsedQuery.
  if (query.budget) {
    const price = resolveAttribute(entity, "priceMonthly");
    if (query.budget.max != null) {
      const known = typeof price === "number";
      checks.push({
        label: `Under $${query.budget.max}/mo`,
        attribute: "priceMonthly",
        passed: known ? (price as number) <= query.budget.max : false,
        unknown: !known,
      });
    }
    if (query.budget.min != null) {
      const known = typeof price === "number";
      checks.push({
        label: `At least $${query.budget.min}/mo`,
        attribute: "priceMonthly",
        passed: known ? (price as number) >= query.budget.min : false,
        unknown: !known,
      });
    }
  }

  return checks;
}

function evalConstraint(entity: Entity, c: QueryConstraint): ConstraintCheck {
  const actual = resolveAttribute(entity, c.attribute);
  if (actual === undefined) {
    // Can't verify a required constraint → fail closed, but flag as unknown so
    // the UI can say "pricing unknown" rather than "too expensive".
    return { label: c.label, attribute: c.attribute, passed: c.operator === "excludes", unknown: true };
  }
  return { label: c.label, attribute: c.attribute, passed: compareOperator(actual, c.operator, c.value), unknown: false };
}

// ─── Preference fit (soft + negative) ────────────────────────────────────────

function prefSatisfied(entity: Entity, pref: QueryPreference): boolean {
  const actual = resolveAttribute(entity, pref.attribute);
  if (actual === undefined) return false;
  // Booleans: preference value true means "want it on".
  if (typeof actual === "boolean") {
    if (typeof pref.value === "boolean") return actual === pref.value;
    return actual === true;
  }
  // Enum/multi attributes: membership test.
  if (typeof pref.value === "string" && String(actual).includes(",")) {
    return asSet(actual).has(pref.value.toLowerCase());
  }
  return String(actual).toLowerCase() === String(pref.value).toLowerCase();
}

function constraintFitScore(
  entity: Entity,
  query: ParsedQuery
): { score: number; soft: PreferenceCheck[]; negative: PreferenceCheck[] } {
  const soft: PreferenceCheck[] = query.softPreferences.map((p) => ({
    label: p.label,
    attribute: p.attribute,
    satisfied: prefSatisfied(entity, p),
  }));
  const negative: PreferenceCheck[] = query.negativePreferences.map((p) => ({
    label: p.label,
    attribute: p.attribute,
    satisfied: prefSatisfied(entity, p),
  }));

  const posWeight = query.softPreferences.reduce((s, p) => s + p.weight, 0);
  const gained = query.softPreferences.reduce((s, p, i) => s + (soft[i].satisfied ? p.weight : 0), 0);
  const softScore = posWeight > 0 ? gained / posWeight : 0.5;

  const negWeight = query.negativePreferences.reduce((s, p) => s + p.weight, 0);
  const negHit = query.negativePreferences.reduce((s, p, i) => s + (negative[i].satisfied ? p.weight : 0), 0);
  const negPenalty = negWeight > 0 ? negHit / negWeight : 0;

  return { score: clamp01(softScore - 0.5 * negPenalty), soft, negative };
}

// ─── Other components ────────────────────────────────────────────────────────

function queryRelevanceScore(entity: Entity, query: ParsedQuery, category: CategoryDefinition): number {
  const tokens = tokenize(query.rawQuery);
  if (tokens.length === 0) return 0.5;

  const haystackParts = [entity.canonicalName, entity.description, ...entity.aliases];
  for (const attr of category.attributes) {
    if (attr.searchable) {
      const v = resolveAttribute(entity, attr.key);
      if (v !== undefined) haystackParts.push(String(v));
    }
  }
  const haystack = ` ${haystackParts.join(" ").toLowerCase()} `;

  let hits = 0;
  for (const t of tokens) if (haystack.includes(t)) hits += 1;
  return hits / tokens.length;
}

/**
 * General quality: Bayesian-adjusted rating aggregated across rating-bearing
 * evidence, weighted by each source's trust. Falls back to the category prior
 * when nothing carries a rating.
 */
function generalQualityScore(entity: Entity, category: CategoryDefinition): { score: number; totalReviews: number } {
  let weightedNormSum = 0;
  let weightSum = 0;
  let totalReviews = 0;

  for (const ev of entity.evidence) {
    const norm = normalizedRating(ev.rating, ev.ratingScale);
    if (norm === null) continue;
    const w = clamp01(ev.confidence) * clamp01(ev.entityMatchConfidence) * (ev.reviewCount + 1);
    weightedNormSum += norm * w;
    weightSum += w;
    totalReviews += ev.reviewCount;
  }

  if (weightSum === 0) {
    const prior = bayesianRating({ rating: null, ratingScale: null, reviewCount: 0, categoryAverage: category.categoryAverageRating });
    return { score: prior.adjusted, totalReviews: 0 };
  }

  const combinedNorm = weightedNormSum / weightSum;
  const adjusted = bayesianRating({
    rating: combinedNorm,
    ratingScale: 1,
    reviewCount: totalReviews,
    categoryAverage: category.categoryAverageRating,
  });
  return { score: adjusted.adjusted, totalReviews };
}

/** Review confidence: log-scaled volume so 10k reviews ≈ 1.0, 10 reviews ≈ 0.25. */
function reviewConfidenceScore(totalReviews: number): number {
  if (totalReviews <= 0) return 0;
  return clamp01(Math.log10(totalReviews + 1) / 4);
}

/** Topic-sentiment match: reward positive sentiment on topics the user asked about. */
function topicSentimentScore(entity: Entity, query: ParsedQuery): number {
  const wanted = new Set(
    [...query.softPreferences].map((p) => String(p.value).toLowerCase()).concat(query.softPreferences.map((p) => p.attribute.toLowerCase()))
  );
  const avoided = new Set(query.negativePreferences.map((p) => String(p.value).toLowerCase()));

  let score = 0;
  let count = 0;
  for (const ev of entity.evidence) {
    for (const topic of ev.reviewTopics ?? []) {
      const t = topic.topic.toLowerCase();
      if (wanted.has(t)) {
        score += (topic.sentiment + 1) / 2; // map -1..1 → 0..1
        count += 1;
      } else if (avoided.has(t)) {
        score += 1 - (topic.sentiment + 1) / 2; // positive sentiment on an avoided topic is bad
        count += 1;
      }
    }
  }
  return count === 0 ? 0.5 : clamp01(score / count);
}

function sourceDiversityScore(entity: Entity, category: CategoryDefinition): number {
  const supported = new Set(category.supportedSources);
  const distinct = new Set(entity.evidence.filter((e) => supported.has(e.sourceType)).map((e) => e.sourceType));
  return clamp01(distinct.size / SOURCE_DIVERSITY_TARGET);
}

function freshnessScore(entity: Entity, category: CategoryDefinition, now: Date): { score: number; stale: boolean } {
  const ages = entity.evidence.map((e) => evidenceAgeDays(e, now)).filter((a) => Number.isFinite(a));
  if (ages.length === 0) return { score: 0, stale: true };
  const avgAge = ages.reduce((s, a) => s + a, 0) / ages.length;
  const score = clamp01(1 - avgAge / category.stalenessThresholdDays);
  return { score, stale: avgAge > category.stalenessThresholdDays };
}

/**
 * Risk level (0 safe .. 1 risky). Combines: stale evidence, conflicting source
 * attributes, thin sourcing (few sources / low match confidence), no rating.
 */
function riskLevel(entity: Entity, category: CategoryDefinition, stale: boolean, totalReviews: number): { level: number; warnings: string[] } {
  const warnings: string[] = [];
  let risk = 0;

  if (stale) {
    risk += 0.4;
    warnings.push("Evidence is older than this category's freshness window.");
  }

  const distinctSources = new Set(entity.evidence.map((e) => e.sourceType)).size;
  if (distinctSources <= 1) {
    risk += 0.25;
    warnings.push("Backed by only a single source.");
  }

  const lowMatch = entity.evidence.some((e) => e.entityMatchConfidence < 0.5);
  if (lowMatch) {
    risk += 0.2;
    warnings.push("Some evidence has low entity-match confidence.");
  }

  if (totalReviews === 0) {
    risk += 0.15;
    warnings.push("No rated reviews found.");
  }

  // Conflicting sources: the same attribute asserted with different values.
  if (hasAttributeConflict(entity)) {
    risk += 0.2;
    warnings.push("Sources disagree on at least one attribute.");
  }

  void category;
  return { level: clamp01(risk), warnings };
}

function hasAttributeConflict(entity: Entity): boolean {
  const seen = new Map<string, AttrValue>();
  for (const ev of entity.evidence) {
    for (const [k, v] of Object.entries(ev.attributes)) {
      if (seen.has(k) && String(seen.get(k)).toLowerCase() !== String(v).toLowerCase()) return true;
      seen.set(k, v);
    }
  }
  return false;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export function scoreCandidate(
  entity: Entity,
  query: ParsedQuery,
  category: CategoryDefinition,
  now: Date = new Date()
): ScoreBreakdown {
  const hardConstraints = evaluateHardConstraints(entity, query);
  const ineligibleReasons = hardConstraints.filter((c) => !c.passed).map((c) => (c.unknown ? `${c.label} (unverifiable)` : c.label));
  const eligible = ineligibleReasons.length === 0;

  const { score: constraintFit, soft, negative } = constraintFitScore(entity, query);
  const queryRelevance = queryRelevanceScore(entity, query, category);
  const semanticRelevance = 0.5; // deterministic placeholder until embeddings (Phase 3)
  const { score: generalQuality, totalReviews } = generalQualityScore(entity, category);
  const reviewConfidence = reviewConfidenceScore(totalReviews);
  const topicSentiment = topicSentimentScore(entity, query);
  const sourceDiversity = sourceDiversityScore(entity, category);
  const { score: freshness, stale } = freshnessScore(entity, category, now);
  const risk = riskLevel(entity, category, stale, totalReviews);

  const components: ScoreComponents = {
    constraintFit,
    queryRelevance,
    semanticRelevance,
    generalQuality,
    reviewConfidence,
    topicSentiment,
    sourceDiversity,
    freshness,
    riskPenalty: risk.level,
  };

  const w = category.weights;
  const positiveWeightSum =
    w.constraintFit +
    w.queryRelevance +
    w.semanticRelevance +
    w.generalQuality +
    w.reviewConfidence +
    w.topicSentiment +
    w.sourceDiversity +
    w.freshness;

  const positiveWeighted =
    w.constraintFit * constraintFit +
    w.queryRelevance * queryRelevance +
    w.semanticRelevance * semanticRelevance +
    w.generalQuality * generalQuality +
    w.reviewConfidence * reviewConfidence +
    w.topicSentiment * topicSentiment +
    w.sourceDiversity * sourceDiversity +
    w.freshness * freshness;

  const positiveScore = positiveWeightSum > 0 ? positiveWeighted / positiveWeightSum : 0;
  const penalty = w.riskPenalty * risk.level;
  const total = eligible ? clamp01(positiveScore - penalty) : 0;

  return {
    entityId: entity.id,
    eligible,
    ineligibleReasons,
    hardConstraints,
    softPreferences: soft,
    negativePreferences: negative,
    components,
    weights: w,
    positiveScore,
    penalty,
    total,
    warnings: risk.warnings,
  };
}

// ─── small helpers ───────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "for", "to", "of", "with", "and", "or", "best", "good", "me", "my",
  "i", "need", "want", "find", "looking", "that", "is", "in", "on", "under", "near",
]);

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9+#. ]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    )
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}
