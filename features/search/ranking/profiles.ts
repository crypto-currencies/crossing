/**
 * Ranking for a broad candidate set (Part 10).
 *
 * Two changes from the engine the audit examined:
 *
 *   1. Reputation signals read the INDEPENDENT evidence class only. Official
 *      claims cannot lift quality, review volume, recency, or sentiment. The
 *      audit's §1.9 failure — quality collapsing to a per-category constant and
 *      the ranking falling through to marketing-page keyword density — is
 *      addressed by scoring missing reputation as an explicit PENALTY rather
 *      than substituting a flattering prior.
 *
 *   2. A `missingData` penalty makes absent evidence cost something. Previously
 *      a candidate with no data scored the category average; now it ranks below
 *      an equivalent candidate with verified facts, which is the honest ordering.
 *
 * Ranking remains fully CODE-DRIVEN and deterministic. A model may summarize
 * evidence into prose elsewhere; nothing here consults one.
 */

import type { CategoryDefinition } from "@/features/recommendation/categories/definitions";
import type { Entity } from "@/features/recommendation/entities/types";
import type { ParsedQuery } from "@/features/recommendation/query/schema";
import { bayesianRating } from "@/features/recommendation/evidence/bayesian";
import type { ClassifiedEvidence } from "../evidence/classes";

// ─── Weights ─────────────────────────────────────────────────────────────────

export interface BroadRankingWeights {
  queryFit: number;
  categoryFit: number;
  priceFit: number;
  locationFit: number;
  reviewQuality: number;
  reviewVolume: number;
  reviewRecency: number;
  topicSentiment: number;
  evidenceDiversity: number;
  freshness: number;
  sourceReliability: number;
  /** Penalties — subtracted, not summed with the positives. */
  riskPenalty: number;
  missingDataPenalty: number;
}

/** Software default. Reputation carries real weight; nothing fills it if absent. */
export const DEFAULT_PROFILE: BroadRankingWeights = {
  queryFit: 0.16,
  categoryFit: 0.06,
  priceFit: 0.12,
  locationFit: 0,
  reviewQuality: 0.18,
  reviewVolume: 0.08,
  reviewRecency: 0.06,
  topicSentiment: 0.08,
  evidenceDiversity: 0.1,
  freshness: 0.08,
  sourceReliability: 0.08,
  riskPenalty: 0.08,
  missingDataPenalty: 0.12,
};

/**
 * Category-specific profiles. Each expresses a real editorial judgment about
 * what matters in that category, not an arbitrary tweak.
 */
export const CATEGORY_PROFILES: Record<string, Partial<BroadRankingWeights>> = {
  // Reliability dominates; a cheap host that falls over is worthless.
  "hosting-platforms": { reviewQuality: 0.22, riskPenalty: 0.12, priceFit: 0.1, freshness: 0.06 },
  // Moves fast — stale evidence is close to useless.
  "ai-tools": { freshness: 0.14, reviewRecency: 0.1, reviewQuality: 0.14 },
  // Buyers are price-sensitive and self-serve.
  "analytics-tools": { priceFit: 0.16, queryFit: 0.18, evidenceDiversity: 0.12 },
  // Deliverability reputation matters more than headline price.
  "email-platforms": { reviewQuality: 0.2, topicSentiment: 0.1, priceFit: 0.1 },
  // Taste-driven; community sentiment is a strong signal.
  "design-tools": { topicSentiment: 0.12, reviewQuality: 0.16 },
  "developer-tools": { queryFit: 0.18, evidenceDiversity: 0.12, freshness: 0.1 },
  "productivity-tools": { queryFit: 0.16, topicSentiment: 0.1, priceFit: 0.14 },
};

export function profileFor(categoryId: string): BroadRankingWeights {
  return { ...DEFAULT_PROFILE, ...(CATEGORY_PROFILES[categoryId] ?? {}) };
}

// ─── Components ──────────────────────────────────────────────────────────────

export interface BroadScoreComponents {
  queryFit: number;
  categoryFit: number;
  priceFit: number;
  locationFit: number;
  reviewQuality: number;
  reviewVolume: number;
  reviewRecency: number;
  topicSentiment: number;
  evidenceDiversity: number;
  freshness: number;
  sourceReliability: number;
  riskLevel: number;
  missingDataLevel: number;
}

export interface BroadScore {
  entityId: string;
  components: BroadScoreComponents;
  weights: BroadRankingWeights;
  positiveScore: number;
  penalty: number;
  total: number;
  /** Human-readable caveats that feed tradeoffs. */
  notes: string[];
}

export interface BroadScoreInput {
  entity: Entity;
  evidence: ClassifiedEvidence;
  query: ParsedQuery;
  category: CategoryDefinition;
  /** How many distinct discovery adapters independently surfaced this entity. */
  corroboratingAdapters: number;
  now: Date;
}

export function scoreBroad(input: BroadScoreInput): BroadScore {
  const { entity, evidence, query, category, now } = input;
  const weights = profileFor(category.id);
  const notes: string[] = [];

  const queryFit = queryFitScore(entity, query);
  const categoryFit = entity.categoryId === category.id ? 1 : 0;
  const { score: priceFit, verified: priceVerified } = priceFitScore(evidence, query);
  const locationFit = locationFitScore(evidence, query);

  // ── Reputation: independent evidence ONLY ────────────────────────────────
  const rep = evidence.reputation;

  let reviewQuality = 0;
  if (rep.aggregateRating !== null) {
    reviewQuality = bayesianRating({
      rating: rep.aggregateRating,
      ratingScale: 1,
      reviewCount: rep.reviewCount,
      categoryAverage: category.categoryAverageRating,
    }).adjusted;
  } else {
    // No independent rating → scores ZERO, and the missing-data penalty applies.
    // It does NOT fall back to the category average, which is what previously
    // let an unrated product look as good as a well-reviewed one.
    notes.push("No independent rating available.");
  }

  const reviewVolume = rep.reviewCount > 0 ? clamp01(Math.log10(rep.reviewCount + 1) / 4) : 0;
  const reviewRecency = recencyScore(rep.recencyDays, category.stalenessThresholdDays);
  const topicSentiment = topicSentimentScore(evidence, query);

  const evidenceDiversity = clamp01(
    (rep.sourceDiversity + evidence.editorial.sourceTypes.length) / 3
  );
  const freshness = freshnessScore(evidence, category.stalenessThresholdDays, now);
  const sourceReliability = reliabilityScore(input.corroboratingAdapters, evidence);

  // ── Penalties ────────────────────────────────────────────────────────────
  const missing: string[] = [];
  if (!evidence.hasIndependent) missing.push("independent reviews");
  if (!priceVerified) missing.push("verified pricing");
  if (evidence.official.sourceUrls.length === 0) missing.push("official product facts");
  const missingDataLevel = clamp01(missing.length / 3);
  if (missing.length > 0) notes.push(`Missing: ${missing.join(", ")}.`);

  let riskLevel = 0;
  if (rep.recencyDays != null && rep.recencyDays > 365) {
    riskLevel += 0.3;
    notes.push("Independent review data is over a year old.");
  }
  if (evidence.hasIndependent && rep.sourceDiversity === 1) {
    riskLevel += 0.2;
    notes.push("Backed by a single independent source.");
  }
  if (input.corroboratingAdapters <= 1 && evidence.official.sourceUrls.length === 0) {
    riskLevel += 0.2;
    notes.push("Surfaced by only one source with no official facts confirmed.");
  }
  riskLevel = clamp01(riskLevel);

  const components: BroadScoreComponents = {
    queryFit,
    categoryFit,
    priceFit,
    locationFit,
    reviewQuality,
    reviewVolume,
    reviewRecency,
    topicSentiment,
    evidenceDiversity,
    freshness,
    sourceReliability,
    riskLevel,
    missingDataLevel,
  };

  // Positive weights normalize among themselves; location drops out entirely
  // for categories where it is weighted 0, rather than diluting the total.
  const positiveKeys = [
    "queryFit", "categoryFit", "priceFit", "locationFit", "reviewQuality",
    "reviewVolume", "reviewRecency", "topicSentiment", "evidenceDiversity",
    "freshness", "sourceReliability",
  ] as const;

  let weightSum = 0;
  let weighted = 0;
  for (const key of positiveKeys) {
    const w = weights[key];
    if (w <= 0) continue;
    weightSum += w;
    weighted += w * components[key];
  }

  const positiveScore = weightSum > 0 ? weighted / weightSum : 0;
  const penalty = weights.riskPenalty * riskLevel + weights.missingDataPenalty * missingDataLevel;
  const total = clamp01(positiveScore - penalty);

  return { entityId: entity.id, components, weights, positiveScore, penalty, total, notes };
}

// ─── Component scorers ───────────────────────────────────────────────────────

const STOP = new Set([
  "a", "an", "the", "for", "to", "of", "with", "and", "or", "best", "good", "me",
  "my", "i", "need", "want", "find", "looking", "that", "is", "in", "on", "under", "near",
]);

function queryFitScore(entity: Entity, query: ParsedQuery): number {
  const tokens = [
    ...new Set(
      query.rawQuery
        .toLowerCase()
        .replace(/[^a-z0-9+#. ]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP.has(t))
    ),
  ];
  if (tokens.length === 0) return 0.5;

  const haystack = ` ${[entity.canonicalName, entity.description, ...entity.aliases].join(" ").toLowerCase()} `;
  let hits = 0;
  for (const t of tokens) if (haystack.includes(t)) hits += 1;
  return hits / tokens.length;
}

function priceFitScore(
  evidence: ClassifiedEvidence,
  query: ParsedQuery
): { score: number; verified: boolean } {
  const { monthly, hasFreePlan } = evidence.official.pricing;
  const verified = monthly !== null || hasFreePlan !== null;
  if (!verified) return { score: 0, verified: false };

  const max = query.budget?.max;
  if (max == null) {
    // No stated budget: a free plan is a mild positive, otherwise neutral.
    return { score: hasFreePlan ? 0.75 : 0.5, verified: true };
  }
  if (monthly === null) return { score: hasFreePlan ? 0.8 : 0.4, verified: true };
  if (monthly > max) return { score: 0, verified: true };
  // Well under budget scores higher, but not so steeply that free always wins.
  return { score: clamp01(1 - monthly / (max * 1.5)), verified: true };
}

function locationFitScore(evidence: ClassifiedEvidence, query: ParsedQuery): number {
  if (!query.location) return 0;
  const loc = evidence.official.location;
  if (!loc) return 0;
  const want = query.location.toLowerCase();
  return loc.toLowerCase().includes(want) ? 1 : 0.2;
}

function recencyScore(days: number | null, threshold: number): number {
  if (days == null) return 0;
  return clamp01(1 - days / (threshold * 4));
}

function topicSentimentScore(evidence: ClassifiedEvidence, query: ParsedQuery): number {
  const wanted = new Set(
    query.softPreferences.flatMap((p) => [String(p.value).toLowerCase(), p.attribute.toLowerCase()])
  );
  const avoided = new Set(query.negativePreferences.map((p) => String(p.value).toLowerCase()));

  let sum = 0;
  let count = 0;
  for (const t of evidence.reputation.topics) {
    const topic = t.topic.toLowerCase();
    if (wanted.has(topic)) {
      sum += (t.sentiment + 1) / 2;
      count += 1;
    } else if (avoided.has(topic)) {
      sum += 1 - (t.sentiment + 1) / 2;
      count += 1;
    }
  }
  // No matching topics → 0, not a flattering 0.5. Absence is not evidence.
  return count === 0 ? 0 : clamp01(sum / count);
}

function freshnessScore(evidence: ClassifiedEvidence, threshold: number, now: Date): number {
  const dates: number[] = [];
  if (evidence.official.retrievedAt) dates.push(new Date(evidence.official.retrievedAt).getTime());
  for (const a of [...evidence.editorial.articles, ...evidence.editorial.discussions]) {
    dates.push(new Date(a.retrievedAt).getTime());
  }
  const valid = dates.filter((d) => Number.isFinite(d));
  if (valid.length === 0) return 0;
  const freshestDays = Math.max(0, (now.getTime() - Math.max(...valid)) / 86_400_000);
  return clamp01(1 - freshestDays / threshold);
}

/** Corroboration across independent discovery adapters + evidence classes. */
function reliabilityScore(corroboratingAdapters: number, evidence: ClassifiedEvidence): number {
  const adapterSignal = clamp01(corroboratingAdapters / 3);
  const classSignal =
    (evidence.official.sourceUrls.length > 0 ? 1 : 0) +
    (evidence.hasIndependent ? 1 : 0) +
    (evidence.editorial.sourceTypes.length > 0 ? 1 : 0);
  return clamp01(adapterSignal * 0.4 + (classSignal / 3) * 0.6);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

/** Deterministic comparator. Ties break on evidence, then id — never randomly. */
export function compareBroadScores(a: BroadScore, b: BroadScore): number {
  if (b.total !== a.total) return b.total - a.total;
  if (b.components.reviewQuality !== a.components.reviewQuality) {
    return b.components.reviewQuality - a.components.reviewQuality;
  }
  if (b.components.evidenceDiversity !== a.components.evidenceDiversity) {
    return b.components.evidenceDiversity - a.components.evidenceDiversity;
  }
  return a.entityId.localeCompare(b.entityId);
}
