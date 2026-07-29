/**
 * Trustpilot review-source adapter.
 *
 * Chosen as the first implementation because it is the strongest fit for the
 * categories that are actually live:
 *   - covers online businesses and software companies (all 7 of our categories),
 *   - has an official API with stable Business Unit IDs,
 *   - matches on DOMAIN, which is the identity key our entities already use,
 *   - and permits aggregate display with attribution.
 *
 * It talks to the official API only. There is no HTML parsing anywhere in this
 * file, and `fetchReviewEvidence` is deliberately NOT implemented because the
 * public tier does not permit review-text retention (see providers.ts).
 *
 * With no `TRUSTPILOT_API_KEY`, every method returns a typed unavailable state.
 * It never invents a rating, and it never falls back to the vendor's own site.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import type { SearchContext } from "../contracts";
import { normalizeDiscoveredUrl, registrableOf } from "../discovery/url";
import { PROVIDER_TERMS } from "./providers";
import {
  MATCH_METHOD_CONFIDENCE,
  expiryFor,
  type Attribution,
  type ProviderAvailability,
  type RatingDistribution,
  type ReviewAggregate,
  type ReviewEntityMatch,
  type ReviewSourceAdapter,
  type StorageMetadata,
  type StoragePolicy,
} from "./types";

const TERMS = PROVIDER_TERMS.trustpilot;
const API_BASE = "https://api.trustpilot.com/v1";
const TIMEOUT_MS = 3_000;

/** Shape of the Business Unit find-by-domain response we depend on. */
interface BusinessUnitResponse {
  id?: string;
  displayName?: string;
  identifyingName?: string;
  websiteUrl?: string;
  score?: { trustScore?: number; stars?: number };
  numberOfReviews?: { total?: number; oneStar?: number; twoStars?: number; threeStars?: number; fourStars?: number; fiveStars?: number };
  links?: { profileUrl?: string }[];
}

export interface TrustpilotDeps {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export class TrustpilotAdapter implements ReviewSourceAdapter {
  readonly id = "trustpilot" as const;
  readonly label = TERMS.label;
  /** Trustpilot is a third party. This is what makes it usable as reputation. */
  readonly independence = "independent" as const;
  readonly policy: StoragePolicy = TERMS.storage;

  constructor(private readonly deps: TrustpilotDeps) {}

  availability(env: NodeJS.ProcessEnv = this.deps.env): ProviderAvailability {
    if (!env.TRUSTPILOT_API_KEY) {
      return {
        available: false,
        reason: "missing-credentials",
        detail: "TRUSTPILOT_API_KEY is not set.",
        requiredAction: TERMS.requiredAction,
      };
    }
    if (env.TRUSTPILOT_ENABLED === "off") {
      return { available: false, reason: "disabled", detail: "Disabled via TRUSTPILOT_ENABLED=off." };
    }
    return { available: true };
  }

  supports(entity: Entity, context: SearchContext): boolean {
    if (this.availability(context.env).available !== true) return false;
    // Domain is the match key — an entity without one cannot be matched safely.
    if (!entity.officialDomain) return false;
    return TERMS.supportedCategories.includes(entity.categoryId);
  }

  /**
   * Match by DOMAIN — the strongest signal available for online businesses, and
   * the one our entities already carry as their canonical identity.
   *
   * Name matching is deliberately absent. Trustpilot hosts many similarly-named
   * business units, and attaching a competitor's reviews to a product is worse
   * than having no reviews at all.
   */
  async matchEntity(entity: Entity, context: SearchContext): Promise<ReviewEntityMatch> {
    const availability = this.availability(context.env);
    if (!availability.available) {
      return { matched: false, provider: this.id, reason: "not-found" };
    }
    if (!TERMS.supportedCategories.includes(entity.categoryId)) {
      return { matched: false, provider: this.id, reason: "unsupported-category" };
    }

    const norm = normalizeDiscoveredUrl(entity.officialDomain);
    if (!norm) {
      return { matched: false, provider: this.id, reason: "insufficient-signals" };
    }
    const domain = registrableOf(norm.host);

    const unit = await this.findBusinessUnit(domain, context);
    if (!unit?.id) {
      return { matched: false, provider: this.id, reason: "not-found" };
    }

    // Verify the unit's own website agrees with the domain we searched. A
    // provider returning a near-miss must not be accepted on faith.
    const unitNorm = unit.websiteUrl ? normalizeDiscoveredUrl(unit.websiteUrl) : null;
    const domainConfirmed = unitNorm ? registrableOf(unitNorm.host) === domain : false;

    const signals = [`queried domain ${domain}`, `business unit ${unit.id}`];
    if (domainConfirmed) signals.push(`unit websiteUrl confirms ${domain}`);

    return {
      matched: true,
      provider: this.id,
      providerEntityId: unit.id,
      providerUrl: profileUrlFor(unit, domain),
      method: domainConfirmed ? "verified-domain" : "official-website",
      confidence: domainConfirmed
        ? MATCH_METHOD_CONFIDENCE["verified-domain"]
        : MATCH_METHOD_CONFIDENCE["official-website"],
      signals,
    };
  }

  async fetchAggregate(match: ReviewEntityMatch, context: SearchContext): Promise<ReviewAggregate | null> {
    if (!match.matched) return null;
    const availability = this.availability(context.env);
    if (!availability.available) return null;

    const unit = await this.getBusinessUnit(match.providerEntityId, context);
    if (!unit) return null;

    const now = (this.deps.now?.() ?? new Date()).toISOString();
    const counts = unit.numberOfReviews ?? {};
    const total = counts.total ?? 0;

    // Trustpilot's `stars` is the 1..5 display rating; `trustScore` is a
    // different 1..10 composite. We take `stars` and keep the scale explicit
    // rather than converting here — normalization is ./normalize.ts's job.
    const stars = unit.score?.stars ?? null;

    const distribution: RatingDistribution | null =
      counts.oneStar != null
        ? {
            1: counts.oneStar ?? 0,
            2: counts.twoStars ?? 0,
            3: counts.threeStars ?? 0,
            4: counts.fourStars ?? 0,
            5: counts.fiveStars ?? 0,
          }
        : null;

    return {
      provider: this.id,
      providerEntityId: match.providerEntityId,
      providerUrl: match.providerUrl,
      rating: stars,
      ratingScale: stars == null ? null : 5,
      reviewCount: total,
      distribution,
      retrievedAt: now,
      // The public tier does not expose a last-review timestamp.
      mostRecentReviewAt: null,
      languageDistribution: {},
      // No review text at this tier → no topic aggregates. Reported as empty
      // rather than fabricated from the rating.
      topics: [],
      matchConfidence: match.confidence,
      sourceConfidence: 0.85,
      attribution: this.attributionFor(match.providerUrl, now),
      storage: this.storageMetadata(now),
    };
  }

  // NOTE: `fetchReviewEvidence` is intentionally not implemented. The public API
  // tier does not permit retaining review text, so deriving topic aggregates
  // from it would violate the terms recorded in providers.ts. When a higher tier
  // is licensed, implement it here and flip `mayStoreReviewText`.

  // ─── Internals ─────────────────────────────────────────────────────────────

  private attributionFor(profileUrl: string, retrievedAt: string): Attribution {
    return {
      providerName: TERMS.label,
      // A KEY, not a URL — the frontend maps it to a bundled asset, so we never
      // hotlink a provider's logo.
      providerLogoKey: "trustpilot",
      sourceUrl: profileUrl,
      requiredText: "Ratings and review counts from Trustpilot.",
      requiresBacklink: true,
      requiresNewTab: true,
      retrievedAt,
    };
  }

  private storageMetadata(retrievedAt: string): StorageMetadata {
    return { ...this.policy, expiresAt: expiryFor(this.policy, retrievedAt) };
  }

  private async findBusinessUnit(domain: string, context: SearchContext): Promise<BusinessUnitResponse | null> {
    const url = `${API_BASE}/business-units/find?name=${encodeURIComponent(domain)}`;
    return this.request<BusinessUnitResponse>(url, context);
  }

  private async getBusinessUnit(id: string, context: SearchContext): Promise<BusinessUnitResponse | null> {
    const url = `${API_BASE}/business-units/${encodeURIComponent(id)}`;
    return this.request<BusinessUnitResponse>(url, context);
  }

  /**
   * One request path, with a hard timeout. Failures return null — an outage
   * means "we could not check", which the pipeline reports as missing evidence
   * rather than as an absence of reviews.
   */
  private async request<T>(url: string, context: SearchContext): Promise<T | null> {
    const key = context.env.TRUSTPILOT_API_KEY ?? this.deps.env.TRUSTPILOT_API_KEY;
    if (!key) return null;

    const doFetch = this.deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    context.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await doFetch(url, {
        headers: { apikey: key, accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", onAbort);
    }
  }
}

function profileUrlFor(unit: BusinessUnitResponse, domain: string): string {
  const fromLinks = unit.links?.find((l) => l.profileUrl)?.profileUrl;
  if (fromLinks) return fromLinks;
  const slug = unit.identifyingName ?? domain;
  return `https://www.trustpilot.com/review/${slug}`;
}
