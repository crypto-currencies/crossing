/**
 * Public surface of the recommendation engine.
 *
 * The engine is entirely server-side and deterministic (Phase 1). Import from
 * here rather than reaching into submodules. The only stateful/AI seams —
 * candidate discovery over a live corpus, an AI-backed parser, evidence refresh
 * jobs — are introduced in later phases (docs/recommendation-engine-plan.md §8).
 */

export { runRecommendation, type RecommendOptions } from "./recommend";
export {
  deterministicParser,
  parseQuerySafe,
  type QueryParser,
} from "./query/parser";
export {
  parsedQuerySchema,
  validateParsedQuery,
  type ParsedQuery,
  type QueryConstraint,
  type QueryPreference,
  type QueryIntent,
} from "./query/schema";
export {
  listCategories,
  getCategory,
  detectCategory,
  type CategoryDefinition,
} from "./categories/definitions";
export {
  resolveCategory,
  CATEGORY_CONFIDENCE_THRESHOLD,
  type CategoryResolution,
  type CategoryStatus,
  type CategoryDomain,
} from "./categories/resolve";
export { scoreCandidate, type ScoreBreakdown } from "./ranking/score";
export { bayesianRating, type BayesianResult } from "./evidence/bayesian";
export type { Evidence, EvidenceSourceType } from "./evidence/types";
export type { Entity } from "./entities/types";
export { buildFixtures, fixturesForCategory } from "./fixtures";
export type {
  RecommendationResult,
  RecommendedItem,
  IneligibleItem,
  ExplanationInput,
  EvidenceRef,
} from "./types";
