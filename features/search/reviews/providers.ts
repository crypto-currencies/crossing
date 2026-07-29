/**
 * Provider registry — terms, limits, and implementation status.
 *
 * Every provider this architecture accommodates is documented here BEFORE any
 * adapter is written, because the terms determine what the adapter is allowed to
 * do. Storage policy in particular is not an implementation detail: whether we
 * may retain review text changes the shape of the data model.
 *
 * `implemented: false` entries are documentation, not stubs. There is no fake
 * adapter anywhere in this module — an unimplemented provider is absent from
 * `buildReviewAdapters()` and reports `not-implemented` if asked for.
 *
 * ⚠️ The terms summarized here reflect published documentation at the time of
 * writing and are NOT legal advice. An owner must confirm current terms before
 * enabling any provider — `requiredAction` on each entry says what that means.
 */

import type { ReviewProviderId, StoragePolicy } from "./types";

export interface ProviderTerms {
  id: ReviewProviderId;
  label: string;
  /** Whether an adapter exists in this codebase today. */
  implemented: boolean;

  // ── Access ──
  /** Env var names required to enable. Empty when the provider is unavailable. */
  credentialEnvVars: string[];
  authentication: string;
  /** Official API, licensed feed, or permitted public interface. Never scraping. */
  accessMethod: "official-api" | "licensed-feed" | "permitted-public-api" | "none";

  // ── Constraints ──
  termsLimitations: string;
  attributionRequirements: string;
  storage: StoragePolicy;
  reviewTextRetention: string;
  displayRequirements: string;
  rateLimits: string;
  deletionObligations: string;

  // ── Coverage ──
  /** Crossing category ids this provider is useful for. */
  supportedCategories: string[];
  geographicCoverage: string;
  dataFreshness: string;

  /** Exactly what an owner must do to enable this provider. */
  requiredAction: string;
}

/** No storage permitted — the safe default for an unimplemented provider. */
const NO_STORAGE: StoragePolicy = {
  mayStoreAggregate: false,
  mayStoreReviewText: false,
  mayStoreDerivedTopics: false,
  maxRetentionDays: null,
  honorsDeletion: true,
};

export const PROVIDER_TERMS: Record<ReviewProviderId, ProviderTerms> = {
  // ── The one implemented adapter ──────────────────────────────────────────
  trustpilot: {
    id: "trustpilot",
    label: "Trustpilot",
    implemented: true,
    credentialEnvVars: ["TRUSTPILOT_API_KEY"],
    authentication: "API key passed as the `apikey` header on Business Units endpoints.",
    accessMethod: "official-api",
    termsLimitations:
      "Public Business Unit endpoints expose aggregate score and review counts. Review text " +
      "requires a higher access tier. Commercial redistribution of review text is restricted; " +
      "aggregates may be displayed with attribution.",
    attributionRequirements:
      "Must display the Trustpilot name, link to the business unit profile page, and show the " +
      "star rating using Trustpilot's own presentation conventions. Logo use is governed by " +
      "Trustpilot brand guidelines.",
    storage: {
      mayStoreAggregate: true,
      // Text retention is NOT permitted at the tier this adapter targets.
      mayStoreReviewText: false,
      mayStoreDerivedTopics: true,
      maxRetentionDays: 30,
      honorsDeletion: true,
    },
    reviewTextRetention:
      "Review text must NOT be persisted at the public API tier. Derived topic aggregates " +
      "(sentiment, counts) may be stored; excerpts may not.",
    displayRequirements:
      "Rating must be shown alongside the review count and the retrieval date. Must link back " +
      "to the Trustpilot profile. Must not present a Trustpilot score as Crossing's own rating.",
    rateLimits: "Tier-dependent; typically a few hundred requests/day on entry tiers.",
    deletionObligations:
      "Aggregates must be refreshed at least every 30 days; stale records are purged rather " +
      "than displayed, so provider-side deletions propagate within the retention window.",
    supportedCategories: [
      "analytics-tools", "hosting-platforms", "email-platforms",
      "productivity-tools", "developer-tools", "design-tools", "ai-tools",
    ],
    geographicCoverage: "Global, strongest in Europe and North America.",
    dataFreshness: "Aggregates update continuously; our refresh cadence is the binding constraint.",
    requiredAction:
      "Register a Trustpilot Business account, request API access, and set TRUSTPILOT_API_KEY.",
  },

  // ── Documented, not implemented ──────────────────────────────────────────
  yelp: {
    id: "yelp",
    label: "Yelp Fusion",
    implemented: false,
    credentialEnvVars: ["YELP_API_KEY"],
    authentication: "Bearer token (Yelp Fusion API key).",
    accessMethod: "official-api",
    termsLimitations:
      "Fusion API returns up to 3 review EXCERPTS only. Caching of Yelp content is limited to " +
      "24 hours. Display must not be reordered or filtered in ways Yelp prohibits.",
    attributionRequirements: "Yelp logo and a link to the Yelp business page are mandatory.",
    storage: { ...NO_STORAGE, mayStoreAggregate: true, maxRetentionDays: 1 },
    reviewTextRetention: "Excerpts may be displayed but not retained beyond 24 hours.",
    displayRequirements: "Yelp-branded star imagery required; must link to the Yelp page.",
    rateLimits: "5,000 calls/day on the standard tier.",
    deletionObligations: "24-hour cache limit effectively enforces deletion propagation.",
    supportedCategories: [],
    geographicCoverage: "Strong in the US/Canada; thin elsewhere.",
    dataFreshness: "Near-real-time.",
    requiredAction:
      "Only relevant once local-business categories ship. Requires a Yelp Fusion API key and " +
      "a compliance review of the 24-hour caching limit against our caching layer.",
  },

  "google-places": {
    id: "google-places",
    label: "Google Places",
    implemented: false,
    credentialEnvVars: ["GOOGLE_PLACES_API_KEY"],
    authentication: "API key, with billing enabled on the Google Cloud project.",
    accessMethod: "official-api",
    termsLimitations:
      "Places content generally may not be cached beyond 30 days, and place IDs are the only " +
      "field with longer permitted retention. Pre-fetching or bulk-storing is restricted.",
    attributionRequirements: '"Powered by Google" attribution and per-review attribution required.',
    storage: { ...NO_STORAGE, mayStoreAggregate: true, maxRetentionDays: 30 },
    reviewTextRetention: "Review text must not be retained; only place IDs may persist long-term.",
    displayRequirements: "Google attribution must be visible wherever the data appears.",
    rateLimits: "Quota- and billing-based.",
    deletionObligations: "30-day maximum caching for most fields.",
    supportedCategories: [],
    geographicCoverage: "Global.",
    dataFreshness: "Near-real-time.",
    requiredAction:
      "Only relevant once local-business categories ship. Requires a billed GCP project and a " +
      "compliance review of the 30-day caching restriction.",
  },

  "app-store": {
    id: "app-store",
    label: "Apple App Store",
    implemented: false,
    credentialEnvVars: ["APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID", "APP_STORE_CONNECT_PRIVATE_KEY"],
    authentication: "JWT signed with an App Store Connect private key.",
    accessMethod: "official-api",
    termsLimitations:
      "App Store Connect exposes ratings/reviews for apps YOU control. Third-party app review " +
      "data requires the public RSS feeds, whose commercial use is constrained.",
    attributionRequirements: "Apple brand guidelines govern any App Store badge or rating display.",
    storage: { ...NO_STORAGE, mayStoreAggregate: true, maxRetentionDays: 7 },
    reviewTextRetention: "Not retained.",
    displayRequirements: "Must not imply Apple endorsement.",
    rateLimits: "Standard App Store Connect limits.",
    deletionObligations: "Refresh weekly.",
    supportedCategories: [],
    geographicCoverage: "Per-storefront; ratings differ by country.",
    dataFreshness: "Daily.",
    requiredAction:
      "Only relevant for a mobile-app category, which does not exist yet. Note the key " +
      "limitation: this API covers apps we own, not arbitrary third-party apps.",
  },

  "google-play": {
    id: "google-play",
    label: "Google Play",
    implemented: false,
    credentialEnvVars: ["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"],
    authentication: "Google service-account OAuth.",
    accessMethod: "official-api",
    termsLimitations: "Play Developer API covers apps you own. No sanctioned third-party review API.",
    attributionRequirements: "Google Play brand guidelines.",
    storage: { ...NO_STORAGE, mayStoreAggregate: true, maxRetentionDays: 7 },
    reviewTextRetention: "Not retained.",
    displayRequirements: "Must not imply Google endorsement.",
    rateLimits: "Standard Play Developer API quotas.",
    deletionObligations: "Refresh weekly.",
    supportedCategories: [],
    geographicCoverage: "Global.",
    dataFreshness: "Daily.",
    requiredAction:
      "Only relevant for a mobile-app category. Same ownership limitation as App Store.",
  },

  g2: {
    id: "g2",
    label: "G2",
    implemented: false,
    credentialEnvVars: ["G2_API_TOKEN"],
    authentication: "Partner API token.",
    accessMethod: "licensed-feed",
    termsLimitations:
      "G2 review data is available only under a commercial partnership. There is no open API " +
      "tier, and scraping G2 is expressly prohibited.",
    attributionRequirements: "Contractually specified; typically logo plus backlink.",
    storage: NO_STORAGE,
    reviewTextRetention: "Contract-dependent.",
    displayRequirements: "Contract-dependent.",
    rateLimits: "Contract-dependent.",
    deletionObligations: "Contract-dependent.",
    supportedCategories: [],
    geographicCoverage: "Global, B2B software focused.",
    dataFreshness: "Continuous.",
    requiredAction:
      "Requires a negotiated G2 partnership. Excellent category fit for our software " +
      "categories, but it is a commercial decision, not a configuration one.",
  },

  capterra: {
    id: "capterra",
    label: "Capterra",
    implemented: false,
    credentialEnvVars: [],
    authentication: "No public API.",
    accessMethod: "none",
    termsLimitations: "No public review API. Gartner Digital Markets licensing required.",
    attributionRequirements: "Contract-dependent.",
    storage: NO_STORAGE,
    reviewTextRetention: "Not permitted without a license.",
    displayRequirements: "Contract-dependent.",
    rateLimits: "n/a",
    deletionObligations: "n/a",
    supportedCategories: [],
    geographicCoverage: "Global, B2B software.",
    dataFreshness: "n/a",
    requiredAction: "Requires a Gartner Digital Markets licensing agreement.",
  },

  tripadvisor: {
    id: "tripadvisor",
    label: "Tripadvisor",
    implemented: false,
    credentialEnvVars: ["TRIPADVISOR_API_KEY"],
    authentication: "API key (Content API).",
    accessMethod: "official-api",
    termsLimitations: "Content API access is approval-gated. Caching limits apply.",
    attributionRequirements: "Tripadvisor logo and backlink required.",
    storage: { ...NO_STORAGE, mayStoreAggregate: true, maxRetentionDays: 1 },
    reviewTextRetention: "Not retained.",
    displayRequirements: "Tripadvisor-branded rating imagery.",
    rateLimits: "Approval-tier dependent.",
    deletionObligations: "24-hour caching limit.",
    supportedCategories: [],
    geographicCoverage: "Global travel/hospitality.",
    dataFreshness: "Near-real-time.",
    requiredAction: "Only relevant for travel/hospitality categories, which do not exist yet.",
  },

  opentable: {
    id: "opentable",
    label: "OpenTable",
    implemented: false,
    credentialEnvVars: [],
    authentication: "Partner-only.",
    accessMethod: "none",
    termsLimitations: "No general-purpose public review API.",
    attributionRequirements: "Contract-dependent.",
    storage: NO_STORAGE,
    reviewTextRetention: "Not permitted.",
    displayRequirements: "Contract-dependent.",
    rateLimits: "n/a",
    deletionObligations: "n/a",
    supportedCategories: [],
    geographicCoverage: "Restaurant reservations.",
    dataFreshness: "n/a",
    requiredAction: "Requires an OpenTable partnership; only relevant for restaurant categories.",
  },
};

/** Providers with an adapter in this codebase. */
export function implementedProviders(): ProviderTerms[] {
  return Object.values(PROVIDER_TERMS).filter((p) => p.implemented);
}

/** Providers documented but awaiting credentials, contracts, or categories. */
export function pendingProviders(): ProviderTerms[] {
  return Object.values(PROVIDER_TERMS).filter((p) => !p.implemented);
}

/** Which providers hold credentials in this environment. */
export function credentialedProviders(env: NodeJS.ProcessEnv): ReviewProviderId[] {
  return Object.values(PROVIDER_TERMS)
    .filter((p) => p.implemented && p.credentialEnvVars.length > 0)
    .filter((p) => p.credentialEnvVars.every((v) => Boolean(env[v])))
    .map((p) => p.id);
}
