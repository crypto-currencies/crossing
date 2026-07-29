/**
 * Statistical normalization and multi-source reputation.
 *
 * The property this module exists to guarantee:
 *
 *   A 5.0 from three reviews MUST NOT outrank a 4.7 from thousands.
 *
 * A naive mean does exactly that, which is why no arithmetic average appears
 * here. Instead each source is shrunk toward the category prior in proportion to
 * how little evidence backs it, then sources are combined by a weight that
 * accounts for volume, recency, provider reliability, and how confident we are
 * the reviews describe THIS entity.
 *
 * Sources are always preserved individually. Disagreement between them is a
 * finding to report, not noise to average away.
 */

import { bayesianRating } from "@/features/recommendation/evidence/bayesian";
import {
  MIN_RANKING_MATCH_CONFIDENCE,
  type ReviewAggregate,
  type ReviewProviderId,
  type ReviewTopic,
  type ReviewTopicAggregate,
} from "./types";

// ─── Tunables ────────────────────────────────────────────────────────────────

/**
 * Bayesian prior weight, in "virtual reviews". A source needs roughly this many
 * real reviews before its own mean dominates the category prior — which is
 * precisely the 5.0-from-3 defense.
 */
export const SHRINKAGE_PRIOR_WEIGHT = 50;

/** Review volume at which volume confidence saturates. */
export const VOLUME_SATURATION = 1_000;

/** Reviews older than this contribute progressively less. */
export const RECENCY_HALF_LIFE_DAYS = 365;

/**
 * How much we trust each provider's data quality, independent of any one
 * entity. Reflects moderation rigor and manipulation resistance.
 */
export const PROVIDER_RELIABILITY: Record<ReviewProviderId, number> = {
  "google-places": 0.9,
  trustpilot: 0.8,
  yelp: 0.85,
  g2: 0.85,
  capterra: 0.8,
  "app-store": 0.75,
  "google-play": 0.75,
  tripadvisor: 0.8,
  opentable: 0.8,
};

// ─── Per-source normalization ────────────────────────────────────────────────

export interface NormalizedSource {
  provider: ReviewProviderId;
  providerUrl: string;
  /** Raw rating mapped to 0..1. Null when the source carried no rating. */
  rawNormalized: number | null;
  /** After Bayesian shrinkage toward the category prior. */
  adjusted: number | null;
  reviewCount: number;
  /** 0..1 — how much this source counts in the blend. */
  weight: number;
  volumeConfidence: number;
  recencyWeight: number;
  reliability: number;
  matchConfidence: number;
  /** True when match confidence is too low to influence ranking. */
  excludedFromRanking: boolean;
  /** Why it was excluded, when it was. */
  exclusionReason: string | null;
  retrievedAt: string;
}

/** Map a rating onto 0..1. Returns null for missing or malformed input. */
export function normalizeScale(rating: number | null, scale: number | null): number | null {
  if (rating == null || scale == null) return null;
  if (!Number.isFinite(rating) || !Number.isFinite(scale) || scale <= 0) return null;
  if (rating < 0) return null;
  return Math.min(rating / scale, 1);
}

/**
 * Log-scaled volume confidence: 10 reviews ≈ 0.33, 100 ≈ 0.67, 1000 ≈ 1.0.
 * Log rather than linear because the difference between 10 and 100 reviews
 * matters far more than between 10,000 and 10,090.
 */
export function volumeConfidence(reviewCount: number): number {
  if (reviewCount <= 0) return 0;
  return clamp01(Math.log10(reviewCount + 1) / Math.log10(VOLUME_SATURATION + 1));
}

/** Exponential decay on the most recent review. Unknown recency is not punished. */
export function recencyWeight(mostRecentReviewAt: string | null, now: Date): number {
  if (!mostRecentReviewAt) return 0.7;
  const at = new Date(mostRecentReviewAt).getTime();
  if (!Number.isFinite(at)) return 0.7;
  const days = Math.max(0, (now.getTime() - at) / 86_400_000);
  return clamp01(Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS));
}

/**
 * Detect distributions that look manipulated.
 *
 * Deliberately conservative — it only fires on a J-curve so extreme it cannot
 * arise from genuine opinion (almost all 5★, almost no middle) on a sample large
 * enough to be meaningful. A real product with genuinely happy customers must
 * not be penalized, so the thresholds are set well past normal.
 */
export function suspicionPenalty(aggregate: ReviewAggregate): { penalty: number; reason: string | null } {
  const d = aggregate.distribution;
  if (!d || aggregate.reviewCount < 30) return { penalty: 0, reason: null };

  const total = d[1] + d[2] + d[3] + d[4] + d[5];
  if (total < 30) return { penalty: 0, reason: null };

  const fiveShare = d[5] / total;
  const middleShare = (d[2] + d[3] + d[4]) / total;

  if (fiveShare > 0.95 && middleShare < 0.02) {
    return { penalty: 0.15, reason: "Rating distribution is implausibly concentrated at 5 stars." };
  }
  // A U-curve with a hollow middle can indicate review-gating campaigns.
  if (middleShare < 0.05 && d[1] / total > 0.2 && fiveShare > 0.6) {
    return { penalty: 0.08, reason: "Rating distribution is unusually polarized." };
  }
  return { penalty: 0, reason: null };
}

export function normalizeSource(
  aggregate: ReviewAggregate,
  categoryAverage: number,
  now: Date
): NormalizedSource {
  const rawNormalized = normalizeScale(aggregate.rating, aggregate.ratingScale);

  const adjusted =
    rawNormalized === null
      ? null
      : bayesianRating({
          rating: rawNormalized,
          ratingScale: 1,
          reviewCount: aggregate.reviewCount,
          categoryAverage,
          minConfidenceThreshold: SHRINKAGE_PRIOR_WEIGHT,
        }).adjusted;

  const volume = volumeConfidence(aggregate.reviewCount);
  const recency = recencyWeight(aggregate.mostRecentReviewAt, now);
  const reliability = PROVIDER_RELIABILITY[aggregate.provider] ?? 0.7;
  const matchConfidence = aggregate.matchConfidence;

  const excluded = matchConfidence < MIN_RANKING_MATCH_CONFIDENCE;

  // Weight multiplies independent confidences: a weak signal on any axis should
  // pull the whole contribution down, not be averaged out by a strong one.
  const weight = excluded
    ? 0
    : clamp01(volume * recency * reliability * matchConfidence * clamp01(aggregate.sourceConfidence));

  return {
    provider: aggregate.provider,
    providerUrl: aggregate.providerUrl,
    rawNormalized,
    adjusted,
    reviewCount: aggregate.reviewCount,
    weight,
    volumeConfidence: volume,
    recencyWeight: recency,
    reliability,
    matchConfidence,
    excludedFromRanking: excluded,
    exclusionReason: excluded
      ? `Entity match confidence ${matchConfidence.toFixed(2)} is below the ${MIN_RANKING_MATCH_CONFIDENCE} threshold.`
      : null,
    retrievedAt: aggregate.retrievedAt,
  };
}

// ─── Multi-source reputation ─────────────────────────────────────────────────

export type ReputationStrength = "strong" | "moderate" | "limited" | "none";

export interface MultiSourceReputation {
  /** 0..1 blended reputation, or null when nothing usable contributed. */
  overall: number | null;
  strength: ReputationStrength;
  /** Sources that actually contributed to `overall`. */
  contributingSources: number;
  /** Every source we looked at, including excluded ones. Never hidden. */
  sources: NormalizedSource[];
  totalReviewCount: number;
  /**
   * 0..1 — how much the sources agree. 1 = identical, low = they disagree.
   * Null when fewer than two sources contributed.
   */
  crossSourceAgreement: number | null;
  /** True when sources disagree enough that the blend should be read cautiously. */
  sourcesDisagree: boolean;
  /** Freshest review data across sources, in days. */
  freshnessDays: number | null;
  commonPraise: string[];
  commonComplaints: string[];
  topics: ReviewTopicAggregate[];
  /** Penalties applied and why — surfaced, never silent. */
  penalties: { reason: string; amount: number }[];
  /** Plain statements about gaps in the reputation picture. */
  notes: string[];
}

/** Agreement above which sources are considered consistent. */
export const AGREEMENT_THRESHOLD = 0.85;
const PRAISE_SENTIMENT = 0.3;

export function combineReputation(
  aggregates: ReviewAggregate[],
  categoryAverage: number,
  now: Date
): MultiSourceReputation {
  const sources = aggregates.map((a) => normalizeSource(a, categoryAverage, now));
  const contributing = sources.filter((s) => s.weight > 0 && s.adjusted !== null);

  const notes: string[] = [];
  const penalties: { reason: string; amount: number }[] = [];

  for (const s of sources) {
    if (s.excludedFromRanking && s.exclusionReason) {
      notes.push(`${s.provider}: ${s.exclusionReason}`);
    }
  }
  for (const a of aggregates) {
    const { penalty, reason } = suspicionPenalty(a);
    if (penalty > 0 && reason) penalties.push({ reason: `${a.provider}: ${reason}`, amount: penalty });
  }

  if (contributing.length === 0) {
    return {
      overall: null,
      strength: "none",
      contributingSources: 0,
      sources,
      totalReviewCount: sources.reduce((n, s) => n + s.reviewCount, 0),
      crossSourceAgreement: null,
      sourcesDisagree: false,
      freshnessDays: null,
      commonPraise: [],
      commonComplaints: [],
      topics: [],
      penalties,
      notes: notes.length ? notes : ["No independent review source returned usable data."],
    };
  }

  const weightSum = contributing.reduce((n, s) => n + s.weight, 0);
  const blended = contributing.reduce((n, s) => n + s.adjusted! * s.weight, 0) / weightSum;

  const totalPenalty = penalties.reduce((n, p) => n + p.amount, 0);
  const overall = clamp01(blended - totalPenalty);

  // Agreement = 1 minus the weighted spread between sources.
  let agreement: number | null = null;
  if (contributing.length >= 2) {
    const mean = contributing.reduce((n, s) => n + s.adjusted!, 0) / contributing.length;
    const spread =
      contributing.reduce((n, s) => n + Math.abs(s.adjusted! - mean), 0) / contributing.length;
    // A 0.2 mean absolute deviation on a 0..1 scale is substantial disagreement.
    agreement = clamp01(1 - spread / 0.2);
  }

  const topics = mergeTopics(aggregates.flatMap((a) => a.topics));
  const totalReviewCount = contributing.reduce((n, s) => n + s.reviewCount, 0);

  const freshness = aggregates
    .map((a) => a.mostRecentReviewAt)
    .filter((d): d is string => Boolean(d))
    .map((d) => (now.getTime() - new Date(d).getTime()) / 86_400_000)
    .filter((d) => Number.isFinite(d));

  const strength = strengthOf(contributing.length, totalReviewCount, agreement);

  if (agreement !== null && agreement < AGREEMENT_THRESHOLD) {
    notes.push("Independent sources disagree about this option — see the per-source breakdown.");
  }
  if (topics.length === 0) {
    notes.push("No topic-level review analysis is available for this option.");
  }

  return {
    overall,
    strength,
    contributingSources: contributing.length,
    sources,
    totalReviewCount,
    crossSourceAgreement: agreement,
    sourcesDisagree: agreement !== null && agreement < AGREEMENT_THRESHOLD,
    freshnessDays: freshness.length ? Math.min(...freshness) : null,
    commonPraise: topics.filter((t) => t.sentiment >= PRAISE_SENTIMENT).map((t) => t.topic),
    commonComplaints: topics.filter((t) => t.sentiment <= -PRAISE_SENTIMENT).map((t) => t.topic),
    topics,
    penalties,
    notes,
  };
}

function strengthOf(
  sourceCount: number,
  reviewCount: number,
  agreement: number | null
): ReputationStrength {
  if (sourceCount === 0) return "none";
  const consistent = agreement === null || agreement >= AGREEMENT_THRESHOLD;
  if (sourceCount >= 2 && reviewCount >= 100 && consistent) return "strong";
  if (sourceCount >= 2 || reviewCount >= 50) return "moderate";
  return "limited";
}

/** Mention-weighted merge, so a 500-review topic outweighs a 3-review one. */
function mergeTopics(topics: ReviewTopicAggregate[]): ReviewTopicAggregate[] {
  const byTopic = new Map<ReviewTopic, { weighted: number; mentions: number; excerpts: ReviewTopicAggregate["supportingExcerpts"] }>();
  for (const t of topics) {
    const acc = byTopic.get(t.topic) ?? { weighted: 0, mentions: 0, excerpts: [] };
    const mentions = Math.max(1, t.mentions);
    acc.weighted += t.sentiment * mentions;
    acc.mentions += mentions;
    acc.excerpts.push(...t.supportingExcerpts);
    byTopic.set(t.topic, acc);
  }
  return [...byTopic.entries()]
    .map(([topic, a]) => ({
      topic,
      sentiment: a.weighted / a.mentions,
      mentions: a.mentions,
      supportingExcerpts: a.excerpts.slice(0, 3),
    }))
    .sort((a, b) => b.mentions - a.mentions || a.topic.localeCompare(b.topic));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}
