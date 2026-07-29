/**
 * Bayesian rating adjustment.
 *
 * Pulls a rating toward the category average in proportion to how few reviews
 * back it, so a 5.0 from 3 reviews doesn't outrank a 4.6 from 8,000. This is
 * the classic "true Bayesian estimate":
 *
 *   adjusted = (C * m + n * r) / (C + n)
 *
 *   r = observed rating (normalized to 0..1)
 *   n = number of reviews
 *   m = prior mean (category average, 0..1)
 *   C = confidence weight — the review count at which we trust `r` about as
 *       much as the prior. Larger C = more skepticism of low-volume ratings.
 *
 * Pure and deterministic — no I/O, unit-tested in bayesian.test.ts.
 */

import { normalizedRating } from "./types";

export interface BayesianInput {
  /** Raw rating as reported by the source (e.g. 4.6). */
  rating: number | null;
  /** The source's scale maximum (e.g. 5, 10, 100). */
  ratingScale: number | null;
  /** Number of reviews behind the rating. */
  reviewCount: number;
  /** Category average on a 0..1 scale — the prior mean. */
  categoryAverage: number;
  /**
   * Confidence weight C (reviews). Defaults to 50: a rating needs ~50 reviews
   * before it's trusted roughly as much as the category prior.
   */
  minConfidenceThreshold?: number;
}

export interface BayesianResult {
  /** Adjusted rating on a 0..1 scale. */
  adjusted: number;
  /** The raw observed rating on a 0..1 scale, or null if missing/invalid. */
  observed: number | null;
  /** 0..1 — how much weight the observed rating carried vs. the prior. */
  evidenceWeight: number;
  /** True when input was missing/invalid and the result fell back to the prior. */
  usedPrior: boolean;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 50;

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/**
 * Compute a Bayesian-adjusted rating. Falls back cleanly to the category
 * average when the rating is missing or the inputs are invalid, so callers
 * never have to special-case unrated entities.
 */
export function bayesianRating(input: BayesianInput): BayesianResult {
  const prior = clamp01(Number.isFinite(input.categoryAverage) ? input.categoryAverage : 0.5);
  const C =
    Number.isFinite(input.minConfidenceThreshold) && (input.minConfidenceThreshold ?? 0) > 0
      ? (input.minConfidenceThreshold as number)
      : DEFAULT_CONFIDENCE_THRESHOLD;

  const observed = normalizedRating(input.rating, input.ratingScale);
  const n = Number.isFinite(input.reviewCount) && input.reviewCount > 0 ? input.reviewCount : 0;

  // No usable rating, or a rating with zero reviews → trust only the prior.
  if (observed === null || n === 0) {
    return { adjusted: prior, observed, evidenceWeight: 0, usedPrior: true };
  }

  const adjusted = (C * prior + n * observed) / (C + n);
  const evidenceWeight = n / (C + n);

  return { adjusted: clamp01(adjusted), observed, evidenceWeight, usedPrior: false };
}
