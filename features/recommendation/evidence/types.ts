/**
 * Normalized evidence shape.
 *
 * Every source (official site, pricing page, docs, GitHub, Reddit, app stores,
 * and — later, only if permitted — review platforms) is normalized into this
 * one shape by a source adapter before the engine sees it. The engine never
 * touches raw source payloads. See docs/recommendation-adding-a-source.md.
 *
 * Phase 1: this data comes from fixtures.ts, not live adapters.
 */

/**
 * Approved source types. `EvidenceSourceType` is an allowlist, not "anything on
 * the web" — adding a member is a deliberate, documented decision (see the
 * legal/ToS risks in docs/recommendation-engine-plan.md §7).
 */
export type EvidenceSourceType =
  // Vendor-controlled. Factual only — these can never assert a rating.
  | "official"
  | "pricing_page"
  | "documentation"
  // Independent review platforms (see features/search/reviews/).
  | "trustpilot"
  | "yelp"
  | "google-places"
  | "app-store"
  | "google-play"
  | "g2"
  | "capterra"
  | "tripadvisor"
  | "opentable"
  // Editorial / community.
  | "github"
  | "reddit"
  | "editorial"
  /** @deprecated superseded by "app-store"; retained for stored fixtures. */
  | "app_store";

/** Aggregated topic sentiment extracted from reviews/discussions for an entity. */
export interface ReviewTopicAggregate {
  topic: string;
  /** -1..1 average polarity across the sampled reviews. */
  sentiment: number;
  /** How many reviews/comments fed this aggregate. */
  mentions: number;
}

/**
 * One normalized evidence record from one source for one entity.
 * Immutable — a refresh writes a new record, it does not mutate an old one.
 */
export interface Evidence {
  sourceType: EvidenceSourceType;
  sourceUrl: string;
  /** ISO timestamp the evidence was captured. Drives freshness scoring. */
  retrievedAt: string;

  /** Raw rating as the source reported it (e.g. 4.6). Null when the source has no rating. */
  rating: number | null;
  /** The source's rating scale maximum (e.g. 5, 10, 100). Required when rating != null. */
  ratingScale: number | null;
  /** Number of reviews behind the rating. 0 when unknown/none. */
  reviewCount: number;

  /** Structured facts this source asserts about the entity (priceMonthly, hasFreePlan, …). */
  attributes: Record<string, string | number | boolean>;

  /** 0..1 — how much we trust this source's data quality in general. */
  confidence: number;
  /** 0..1 — how confident we are this evidence is about THIS entity (see entities/normalize.ts). */
  entityMatchConfidence: number;

  /** Optional per-topic sentiment aggregates. */
  reviewTopics?: ReviewTopicAggregate[];
}

/** Normalize a raw rating onto a 0..1 scale. Returns null for missing/invalid input. */
export function normalizedRating(rating: number | null, scale: number | null): number | null {
  if (rating == null || scale == null) return null;
  if (!Number.isFinite(rating) || !Number.isFinite(scale) || scale <= 0) return null;
  if (rating < 0) return null;
  return Math.min(rating / scale, 1);
}

/** Age of a piece of evidence in whole days, relative to `now`. */
export function evidenceAgeDays(evidence: Evidence, now: Date = new Date()): number {
  const captured = new Date(evidence.retrievedAt).getTime();
  if (!Number.isFinite(captured)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - captured) / 86_400_000);
}
