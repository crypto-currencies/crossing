/**
 * Independent review & reputation evidence — adapter contract.
 *
 * THE CORE RULE, enforced structurally rather than by convention:
 *
 *   An official website may establish name, pricing, features, location,
 *   hours, platforms, and capabilities.
 *
 *   An official website may NEVER establish rating, review count, sentiment,
 *   reputation, trust, or popularity.
 *
 * Those two sets of facts travel through entirely separate types in this
 * codebase. `OfficialFacts` (../evidence/classes.ts) has no rating field to
 * populate; `ReviewAggregate` here can only be produced by a
 * `ReviewSourceAdapter`, and every adapter is a third party by construction —
 * there is no adapter that reads a vendor's own site, and one cannot be added
 * without failing `assertIndependentProvider`.
 *
 * A vendor's testimonials page, star widget, or `aggregateRating` JSON-LD is
 * marketing. It is stripped on ingest (features/ingestion/evidence.ts), stripped
 * again by source independence (../sources/types.ts), and stripped a third time
 * by source class (../evidence/classes.ts). It cannot reach this module.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import type { SearchContext } from "../contracts";

// ─── Providers ───────────────────────────────────────────────────────────────

/**
 * Review providers this architecture is designed to accommodate. Presence here
 * means "the interface fits this provider", NOT "an adapter exists" — see
 * `PROVIDER_REGISTRY` in ./providers.ts for implementation status.
 */
export const REVIEW_PROVIDER_IDS = [
  "trustpilot",
  "yelp",
  "google-places",
  "app-store",
  "google-play",
  "g2",
  "capterra",
  "tripadvisor",
  "opentable",
] as const;

export type ReviewProviderId = (typeof REVIEW_PROVIDER_IDS)[number];

// ─── Entity matching ─────────────────────────────────────────────────────────

/**
 * How a candidate was matched to a provider's record. Ordered strongest-first;
 * `name-only` exists to be REJECTED, never to be used.
 */
export type MatchMethod =
  | "verified-domain"
  | "provider-id"
  | "exact-address"
  | "phone"
  | "coordinates"
  | "official-website"
  | "name-location"
  | "name-only";

/** Match strength by method. `name-only` is deliberately below every threshold. */
export const MATCH_METHOD_CONFIDENCE: Record<MatchMethod, number> = {
  "provider-id": 1.0,
  "verified-domain": 0.97,
  "official-website": 0.95,
  "exact-address": 0.92,
  phone: 0.9,
  coordinates: 0.85,
  "name-location": 0.8,
  // A name resemblance alone is not evidence of identity. Kept in the enum so
  // it can be represented and rejected rather than silently becoming something
  // stronger.
  "name-only": 0.3,
};

/**
 * Below this, review data is retained for audit but MUST NOT influence ranking.
 * Attaching a competitor's reviews to a product is worse than having none.
 */
export const MIN_RANKING_MATCH_CONFIDENCE = 0.85;

export type ReviewEntityMatch =
  | {
      matched: true;
      provider: ReviewProviderId;
      /** The provider's stable identifier for this business/product. */
      providerEntityId: string;
      /** Canonical URL of the provider's page, for attribution. */
      providerUrl: string;
      method: MatchMethod;
      /** 0..1. Below MIN_RANKING_MATCH_CONFIDENCE it cannot affect ranking. */
      confidence: number;
      /** What actually corroborated the match — audit trail, never inferred. */
      signals: string[];
    }
  | {
      matched: false;
      provider: ReviewProviderId;
      reason: "not-found" | "ambiguous" | "insufficient-signals" | "unsupported-category";
      /** Candidates considered, when the failure was ambiguity. */
      consideredCount?: number;
    };

export function canInfluenceRanking(match: ReviewEntityMatch): boolean {
  return match.matched && match.confidence >= MIN_RANKING_MATCH_CONFIDENCE;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export interface RatingDistribution {
  /** Count per star bucket, 1..5. Absent when the provider does not expose it. */
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewTopicAggregate {
  topic: ReviewTopic;
  /** -1..1 mention-weighted sentiment. */
  sentiment: number;
  mentions: number;
  /**
   * Short supporting excerpts, ONLY when the provider's terms permit storing
   * review text. Empty otherwise — see `StoragePolicy.mayStoreReviewText`.
   */
  supportingExcerpts: { text: string; reviewUrl?: string }[];
}

/** Topics we derive. Category-agnostic superset; not all apply everywhere. */
export const REVIEW_TOPICS = [
  "reliability",
  "customer-service",
  "value",
  "ease-of-use",
  "atmosphere",
  "noise",
  "amenities",
  "delivery",
  "performance",
  "privacy",
] as const;

export type ReviewTopic = (typeof REVIEW_TOPICS)[number];

/**
 * One provider's normalized view of one entity.
 *
 * Note there is no single "score" here. Normalization, shrinkage, and weighting
 * happen in ./normalize.ts against the whole multi-source picture — collapsing
 * a provider to one number at this layer would throw away the volume, recency,
 * and distribution information that makes the shrinkage meaningful.
 */
export interface ReviewAggregate {
  provider: ReviewProviderId;
  providerEntityId: string;
  providerUrl: string;

  /** Rating as the provider reports it, on ITS OWN scale. Never pre-converted. */
  rating: number | null;
  /** The provider's scale maximum (5, 10, 100…). Required when rating != null. */
  ratingScale: number | null;
  reviewCount: number;
  distribution: RatingDistribution | null;

  /** When we fetched this. */
  retrievedAt: string;
  /** Timestamp of the most recent review, when exposed. Drives recency weighting. */
  mostRecentReviewAt: string | null;

  /** ISO language code → share of reviews (0..1). Empty when not exposed. */
  languageDistribution: Record<string, number>;

  topics: ReviewTopicAggregate[];

  /** How sure we are this is the right entity. */
  matchConfidence: number;
  /** How much we trust this provider's data quality in general. */
  sourceConfidence: number;

  attribution: Attribution;
  storage: StorageMetadata;
}

// ─── Attribution & storage policy ────────────────────────────────────────────

/**
 * Everything a provider requires us to display. Returned to the client so the
 * frontend cannot accidentally violate provider terms by omission — if a
 * provider requires a logo and a backlink, those requirements travel with the
 * data rather than living in a design decision someone might forget.
 */
export interface Attribution {
  providerName: string;
  /** Stable key the frontend maps to a bundled asset. Never a hotlinked URL. */
  providerLogoKey: string | null;
  /** The page this data came from. Required backlink target. */
  sourceUrl: string;
  /** Verbatim legal text the provider mandates, when any. */
  requiredText: string | null;
  /** Whether the rating must link back to the provider. */
  requiresBacklink: boolean;
  /** Whether the backlink must open in a new tab. */
  requiresNewTab: boolean;
  retrievedAt: string;
}

export interface StoragePolicy {
  /** May we persist aggregate rating + count? */
  mayStoreAggregate: boolean;
  /** May we persist individual review TEXT? Usually false. */
  mayStoreReviewText: boolean;
  /** May we persist derived topic sentiment (not text)? */
  mayStoreDerivedTopics: boolean;
  /** Max days we may retain the data before refresh or deletion. */
  maxRetentionDays: number | null;
  /** Must we honor provider-side deletions/updates on refresh? */
  honorsDeletion: boolean;
}

export interface StorageMetadata extends StoragePolicy {
  /** When this record must be refreshed or purged. */
  expiresAt: string | null;
}

// ─── Fetch options ───────────────────────────────────────────────────────────

export interface ReviewFetchOptions {
  /** Max reviews to sample for topic derivation. */
  maxReviews: number;
  /** Only consider reviews newer than this. */
  since?: string;
  signal?: AbortSignal;
}

export interface ReviewEvidenceBatch {
  provider: ReviewProviderId;
  providerEntityId: string;
  /** Derived aggregates. Always safe to persist when policy allows. */
  topics: ReviewTopicAggregate[];
  /** How many reviews the aggregates were derived from. */
  sampledCount: number;
  /**
   * Raw review text, present ONLY when `mayStoreReviewText` is true AND the
   * caller needs it in-process. Never persisted by the pipeline.
   */
  reviews?: { text: string; rating: number; createdAt: string; url?: string }[];
}

// ─── Availability ────────────────────────────────────────────────────────────

/**
 * A typed unavailable state. Adapters return this rather than throwing or —
 * critically — rather than returning empty data that reads as "no reviews
 * exist". "We could not check" and "there are none" are different facts and the
 * pipeline reports them differently.
 */
export type ProviderAvailability =
  | { available: true }
  | {
      available: false;
      reason:
        | "missing-credentials"
        | "not-implemented"
        | "category-unsupported"
        | "region-unsupported"
        | "disabled"
        | "quota-exceeded"
        | "provider-error";
      /** Operator-facing. Never surfaced to an end user verbatim. */
      detail: string;
      /** Exactly what an owner must do, when the fix is a credential. */
      requiredAction?: string;
    };

// ─── Adapter ─────────────────────────────────────────────────────────────────

export interface ReviewSourceAdapter {
  readonly id: ReviewProviderId;
  readonly label: string;
  /** Independence is asserted at construction — see assertIndependentProvider. */
  readonly independence: "independent";
  readonly policy: StoragePolicy;

  /** Whether credentials/config allow this adapter to run at all. */
  availability(env: NodeJS.ProcessEnv): ProviderAvailability;

  /** Whether this adapter covers this entity's category/region. */
  supports(entity: Entity, context: SearchContext): boolean;

  matchEntity(entity: Entity, context: SearchContext): Promise<ReviewEntityMatch>;

  fetchAggregate(match: ReviewEntityMatch, context: SearchContext): Promise<ReviewAggregate | null>;

  /** Optional: only for providers whose terms permit review-text processing. */
  fetchReviewEvidence?(
    match: ReviewEntityMatch,
    options: ReviewFetchOptions,
    context: SearchContext
  ): Promise<ReviewEvidenceBatch>;
}

/**
 * Guard invoked by the registry when an adapter is registered.
 *
 * Its job is to make the core rule un-bypassable: an adapter whose data
 * originates from the entity's own domain is not independent evidence, and
 * registering one is a programming error rather than a configuration choice.
 */
export function assertIndependentProvider(adapter: ReviewSourceAdapter): void {
  if (adapter.independence !== "independent") {
    throw new Error(
      `Review adapter "${adapter.id}" is not marked independent. Official-site data ` +
        `cannot be a review source (see features/search/reviews/types.ts).`
    );
  }
  if (!(REVIEW_PROVIDER_IDS as readonly string[]).includes(adapter.id)) {
    throw new Error(`Unknown review provider "${adapter.id}".`);
  }
}

/** Default expiry from a policy, for StorageMetadata. */
export function expiryFor(policy: StoragePolicy, retrievedAt: string): string | null {
  if (policy.maxRetentionDays == null) return null;
  const at = new Date(retrievedAt).getTime();
  if (!Number.isFinite(at)) return null;
  return new Date(at + policy.maxRetentionDays * 86_400_000).toISOString();
}
