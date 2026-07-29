/**
 * Local discovery — provider-agnostic architecture (Part 12).
 *
 * Crossing should eventually answer "quiet coffee shop with outlets near me".
 * This module defines the DOMAIN and the adapter seam only. It deliberately
 * ships with NO provider:
 *
 *   - We do not scrape Yelp, Google Maps, or any restricted platform.
 *   - With no provider configured the result is an honest `unsupported` state.
 *   - There is NO software fallback: a local query never silently returns
 *     analytics tools. Category gating is preserved end to end.
 *   - Nothing is fabricated — every field must come from a provider that
 *     licenses it, and its attribution + retention rules travel with the data.
 */

import { z } from "zod";

// ─── Location input ───────────────────────────────────────────────────────────

/** Coordinates only ever arrive with explicit user consent. */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Reported accuracy in metres, when the client provides it. */
  accuracyMeters: z.number().positive().max(100_000).optional(),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** A typed place name — always available, never requires a permission prompt. */
export const placeQuerySchema = z.object({
  text: z.string().trim().min(2).max(120),
});

export const locationInputSchema = z.union([
  z.object({ kind: z.literal("coordinates"), consent: z.literal(true), value: coordinatesSchema }),
  z.object({ kind: z.literal("place"), value: placeQuerySchema }),
]);
export type LocationInput = z.infer<typeof locationInputSchema>;

/**
 * Coordinates are accepted ONLY with explicit consent. The schema encodes this
 * (`consent: true` is required), so an unconsented payload cannot type-check or
 * validate.
 */
export function requiresExplicitConsent(input: LocationInput): boolean {
  return input.kind === "coordinates";
}

export const localQuerySchema = z.object({
  query: z.string().trim().min(1).max(300),
  location: locationInputSchema,
  radiusMeters: z.number().int().min(100).max(50_000).default(5_000),
  openNow: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(50).default(20),
});
export type LocalQuery = z.infer<typeof localQuerySchema>;

// ─── Result domain ────────────────────────────────────────────────────────────

export interface OpeningHours {
  /** 0 = Sunday. */
  weekday: number;
  /** Local "HH:MM" 24h. */
  opens: string;
  closes: string;
}

export interface LocalCandidate {
  providerId: string;
  /** Provider-scoped id; never assumed globally unique. */
  externalId: string;
  name: string;
  categoryHint: string | null;
  coordinates: Coordinates | null;
  distanceMeters: number | null;
  address: string | null;
  hours: OpeningHours[] | null;
  openNow: boolean | null;
  /** 1–4 style band, when the provider licenses it. */
  priceLevel: number | null;
  rating: number | null;
  ratingScale: number | null;
  reviewCount: number | null;
  amenities: string[];
  accessibility: string[];
  /** Provider's canonical URL for the place, for attribution links. */
  sourceUrl: string | null;
}

/** Attribution + licensing obligations that must be honored when rendering. */
export interface ProviderAttribution {
  /** Human-readable credit, e.g. "Data © OpenStreetMap contributors". */
  requiredText: string;
  requiredUrl: string | null;
  /** True when the provider forbids showing results without its logo/link. */
  mustDisplay: boolean;
}

/** Storage rules the adapter declares; the cache layer must obey them. */
export interface ProviderRetentionPolicy {
  /** Max seconds a response may be cached. 0 = must not be stored at all. */
  maxCacheSeconds: number;
  /** True when only ids may be persisted, not the content. */
  idsOnly: boolean;
  /** True when results may not be persisted to our own database at all. */
  prohibitsPersistence: boolean;
  notes: string;
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  attribution: ProviderAttribution;
  retention: ProviderRetentionPolicy;
  /** Categories this provider is licensed/able to answer. */
  supportedCategories: string[];
}

// ─── Adapter seam ─────────────────────────────────────────────────────────────

export interface LocalDiscoveryProvider {
  readonly metadata: ProviderMetadata;
  /** Resolve typed place text to coordinates. */
  geocode(text: string): Promise<Coordinates | null>;
  /** Retrieve nearby candidates. Must never invent results. */
  findNearby(query: LocalQuery, at: Coordinates): Promise<LocalCandidate[]>;
}

export type LocalDiscoveryStatus =
  | "unsupported_no_provider"
  | "unsupported_category"
  | "invalid_location"
  | "geocode_failed"
  | "ok";

export type LocalDiscoveryResult =
  | {
      status: "ok";
      candidates: LocalCandidate[];
      attribution: ProviderAttribution;
      retention: ProviderRetentionPolicy;
      providerId: string;
    }
  | {
      status: Exclude<LocalDiscoveryStatus, "ok">;
      message: string;
      /** Always empty — there is never a software fallback for a local query. */
      candidates: [];
    };

/**
 * Run a local query through the configured provider.
 *
 * With no provider registered this returns `unsupported_no_provider` and an
 * empty candidate list — it never falls back to the software corpus.
 */
export async function runLocalDiscovery(
  query: LocalQuery,
  provider: LocalDiscoveryProvider | null,
  opts: { categoryId?: string | null } = {}
): Promise<LocalDiscoveryResult> {
  if (!provider) {
    return {
      status: "unsupported_no_provider",
      message: "Local recommendations aren't available yet — Crossing has no local data provider configured.",
      candidates: [],
    };
  }

  if (opts.categoryId && !provider.metadata.supportedCategories.includes(opts.categoryId)) {
    return {
      status: "unsupported_category",
      message: "This local category isn't supported by the configured provider.",
      candidates: [],
    };
  }

  let at: Coordinates | null = null;
  if (query.location.kind === "coordinates") {
    at = query.location.value;
  } else {
    at = await provider.geocode(query.location.value.text);
    if (!at) {
      return { status: "geocode_failed", message: "We couldn't find that place.", candidates: [] };
    }
  }

  const candidates = await provider.findNearby(query, at);
  return {
    status: "ok",
    candidates: candidates.slice(0, query.maxResults),
    attribution: provider.metadata.attribution,
    retention: provider.metadata.retention,
    providerId: provider.metadata.id,
  };
}

/**
 * Provider registry. Empty until the owner supplies credentials AND approves
 * the provider's terms — see docs/backend-product-plan.md §8 (phase P6).
 */
export function getConfiguredProvider(): LocalDiscoveryProvider | null {
  return null;
}
