/**
 * Ranking weight profiles.
 *
 * Weights are per-category (see categories/definitions.ts) and each profile's
 * component weights are expected to sum to ~1.0 so the final score stays on a
 * comparable 0..1 scale across categories. The scorer (./score.ts) normalizes
 * by the actual weight sum, so profiles that don't sum to exactly 1 still work.
 */

/** One weight per scoring component. All components are documented in ./score.ts. */
export interface RankingWeights {
  /** How well the candidate satisfies soft/negative preferences. */
  constraintFit: number;
  /** Lexical relevance of the query to the candidate's name/description/attributes. */
  queryRelevance: number;
  /** Placeholder for future embedding similarity (kept 0-ish until Phase 3). */
  semanticRelevance: number;
  /** Bayesian-adjusted quality from ratings across sources. */
  generalQuality: number;
  /** How much review volume backs the quality signal. */
  reviewConfidence: number;
  /** Alignment of review-topic sentiment with the query's preferences. */
  topicSentiment: number;
  /** How many distinct credible sources corroborate the candidate. */
  sourceDiversity: number;
  /** Recency of the underlying evidence. */
  freshness: number;
  /** Penalty band for risk signals (stale, conflicting, thin sourcing). */
  riskPenalty: number;
}

export const SCORE_COMPONENTS: (keyof RankingWeights)[] = [
  "constraintFit",
  "queryRelevance",
  "semanticRelevance",
  "generalQuality",
  "reviewConfidence",
  "topicSentiment",
  "sourceDiversity",
  "freshness",
  "riskPenalty",
];

/** Number of distinct sources at which source-diversity credit saturates. */
export const SOURCE_DIVERSITY_TARGET = 4;
