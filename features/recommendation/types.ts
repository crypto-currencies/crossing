/**
 * Public recommendation output types — the serializable shape the API layer
 * and UI consume. Kept free of Prisma/DB types so it can be returned as-is.
 */

import type { ParsedQuery } from "./query/schema";
import type { ScoreBreakdown } from "./ranking/score";
import type { EvidenceSourceType } from "./evidence/types";
import type { CategoryResolution } from "./categories/resolve";

/** A single evidence pointer surfaced to the client (never the raw payload). */
export interface EvidenceRef {
  sourceType: EvidenceSourceType | string;
  sourceUrl: string;
  retrievedAt: string;
  rating: number | null;
  ratingScale: number | null;
  reviewCount: number;
}

export interface RecommendedItem {
  entityId: string;
  name: string;
  domain: string;
  categoryId: string;
  /** Final deterministic score, 0..1. */
  score: number;
  breakdown: ScoreBreakdown;
  /** Labels of hard constraints this candidate satisfied. */
  matchedConstraints: string[];
  /** Labels of soft preferences this candidate did NOT satisfy. */
  unmetPreferences: string[];
  /** Human-readable caveats (weak sourcing, missing free plan, matched dislikes…). */
  tradeoffs: string[];
  evidenceRefs: EvidenceRef[];
  /** Freshness/quality warnings from the scorer. */
  freshnessWarnings: string[];
}

export interface IneligibleItem {
  entityId: string;
  name: string;
  reasons: string[];
}

export type ConfidenceLevel = "low" | "medium" | "high";

/** A single factual statement for the explanation layer, tied to its source. */
export interface ExplanationClaim {
  kind: "rating" | "attribute" | "constraint" | "tradeoff" | "freshness";
  text: string;
  /** Provenance URL when the claim comes from a specific evidence source. */
  evidenceUrl?: string;
}

export interface ExplanationSubject {
  name: string;
  score: number;
  claims: ExplanationClaim[];
}

/**
 * The constrained input a future LLM turns into prose. It contains ONLY facts
 * already derived from evidence + the deterministic breakdown; the generator is
 * instructed to add nothing beyond these claims.
 */
export interface ExplanationInput {
  query: string;
  categoryName: string | null;
  best: ExplanationSubject | null;
  alternatives: ExplanationSubject[];
  /** Guardrail handed to the LLM alongside the claims. */
  instruction: string;
}

/**
 * Development-only pipeline diagnostics — how the gate resolved and what it did.
 * Populated on every result; the API forwards it to the client and logs only in
 * development (never exposed in the production UI). See docs Part 9.
 */
export interface RecommendationDiagnostics {
  resolvedDomain: string;
  resolvedCategoryId: string | null;
  resolutionStatus: string;
  confidence: number;
  candidateCount: number;
  candidateCategoryIds: string[];
  /** Whether the ranking engine was actually invoked (false for gated queries). */
  rankingInvoked: boolean;
  /** Evidence mode of the scored corpus when official-evidence enrichment ran. */
  evidenceMode?: "seeded" | "mixed" | "live";
  /** Where candidates came from: the demo fixture corpus, or the DB repository. */
  candidateSource?: "fixture" | "db";
}

export interface RecommendationResult {
  query: ParsedQuery;
  /** The gating decision. When status !== "supported", nothing was ranked. */
  resolution: CategoryResolution;
  categoryId: string | null;
  categoryName: string | null;
  best: RecommendedItem | null;
  alternatives: RecommendedItem[];
  ineligible: IneligibleItem[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  generatedAt: string;
  explanationInput: ExplanationInput;
  /** Dev-only pipeline trace (see RecommendationDiagnostics). */
  diagnostics?: RecommendationDiagnostics;
}
