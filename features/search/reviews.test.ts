/**
 * Independent review & reputation tests.
 *
 * Hermetic: a stubbed fetch, an injected clock, no network. The central
 * guarantee under test is the core rule — an official website can establish
 * facts but never reputation — plus the statistical property that a 5.0 from
 * three reviews must not beat a 4.7 from thousands.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import { FixtureEntityRepository } from "@/features/entities/repository";
import type { SearchContext } from "./contracts";

import { TrustpilotAdapter } from "./reviews/trustpilot";
import { PROVIDER_TERMS, credentialedProviders, implementedProviders, pendingProviders } from "./reviews/providers";
import { ReviewService, toEvidenceRecords } from "./reviews/service";
import { ReviewEvidenceSource, buildReviewAdapters, buildReviewService } from "./reviews/default";
import {
  AGREEMENT_THRESHOLD,
  combineReputation,
  normalizeScale,
  normalizeSource,
  recencyWeight,
  suspicionPenalty,
  volumeConfidence,
} from "./reviews/normalize";
import {
  MATCH_METHOD_CONFIDENCE,
  MIN_RANKING_MATCH_CONFIDENCE,
  assertIndependentProvider,
  canInfluenceRanking,
  expiryFor,
  type ReviewAggregate,
  type ReviewEntityMatch,
  type ReviewSourceAdapter,
} from "./reviews/types";
import { classifyEvidence, reputationFrom } from "./evidence/classes";
import { LiveSearchOrchestrator } from "./live-orchestrator";
import { CanonicalDiscoveryAdapter } from "./discovery/adapters";

const NOW = new Date("2026-07-20T00:00:00Z");
const KEYED = { NODE_ENV: "development", TRUSTPILOT_API_KEY: "test-key" } as NodeJS.ProcessEnv;
const UNKEYED = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

function ctx(env: NodeJS.ProcessEnv = KEYED): SearchContext {
  return { requestId: "t", now: NOW, env, deadlineMs: 5000, isDev: true };
}

function ent(over: Partial<Entity> = {}): Entity {
  return {
    id: "matomo",
    canonicalName: "Matomo",
    officialDomain: "https://matomo.org",
    domainKey: "matomo.org",
    categoryId: "analytics-tools",
    aliases: [],
    description: "Open-source web analytics.",
    attributes: { hasFreePlan: true },
    externalIds: [],
    evidence: [],
    lastUpdatedAt: NOW.toISOString(),
    ...over,
  };
}

/** Stub the Trustpilot API. No network, no HTML — the API shape only. */
function stubFetch(
  unit: Record<string, unknown> | null,
  opts: { status?: number } = {}
): typeof fetch {
  return (async (url: string) => {
    if (opts.status && opts.status !== 200) {
      return { ok: false, status: opts.status, async json() { return {}; } } as unknown as Response;
    }
    if (!unit) {
      return { ok: false, status: 404, async json() { return {}; } } as unknown as Response;
    }
    void url;
    return { ok: true, status: 200, async json() { return unit; } } as unknown as Response;
  }) as unknown as typeof fetch;
}

const MATOMO_UNIT = {
  id: "bu-matomo-1",
  displayName: "Matomo",
  identifyingName: "matomo.org",
  websiteUrl: "https://matomo.org",
  score: { trustScore: 8.6, stars: 4.3 },
  numberOfReviews: { total: 1240, oneStar: 40, twoStars: 30, threeStars: 80, fourStars: 300, fiveStars: 790 },
  links: [{ profileUrl: "https://www.trustpilot.com/review/matomo.org" }],
};

function aggregate(over: Partial<ReviewAggregate> = {}): ReviewAggregate {
  return {
    provider: "trustpilot",
    providerEntityId: "bu-1",
    providerUrl: "https://www.trustpilot.com/review/example.com",
    rating: 4.3,
    ratingScale: 5,
    reviewCount: 1000,
    distribution: null,
    retrievedAt: NOW.toISOString(),
    mostRecentReviewAt: NOW.toISOString(),
    languageDistribution: {},
    topics: [],
    matchConfidence: 0.97,
    sourceConfidence: 0.85,
    attribution: {
      providerName: "Trustpilot",
      providerLogoKey: "trustpilot",
      sourceUrl: "https://www.trustpilot.com/review/example.com",
      requiredText: "Ratings and review counts from Trustpilot.",
      requiresBacklink: true,
      requiresNewTab: true,
      retrievedAt: NOW.toISOString(),
    },
    storage: { ...PROVIDER_TERMS.trustpilot.storage, expiresAt: null },
    ...over,
  };
}

// ─── The core rule ───────────────────────────────────────────────────────────

test("core rule — an official source can never produce reputation", () => {
  const officialWithFakeRating: Evidence = {
    sourceType: "official",
    sourceUrl: "https://matomo.org/testimonials",
    retrievedAt: NOW.toISOString(),
    rating: 5,
    ratingScale: 5,
    reviewCount: 10_000,
    attributes: { hasFreePlan: true },
    confidence: 0.9,
    entityMatchConfidence: 1,
    reviewTopics: [{ topic: "reliability", sentiment: 1, mentions: 500 }],
  };

  const rep = reputationFrom([officialWithFakeRating], NOW);
  assert.equal(rep.aggregateRating, null, "vendor testimonials must not aggregate");
  assert.equal(rep.reviewCount, 0);
  assert.equal(rep.sourceDiversity, 0);
  assert.equal(rep.topics.length, 0, "vendor-supplied topics must not count");
});

test("core rule — official facts still flow through untouched", () => {
  const classified = classifyEvidence(
    [
      {
        sourceType: "official",
        sourceUrl: "https://matomo.org/",
        retrievedAt: NOW.toISOString(),
        rating: null,
        ratingScale: null,
        reviewCount: 0,
        attributes: { priceMonthly: 19, hasFreePlan: true, platforms: "web,api" },
        confidence: 0.8,
        entityMatchConfidence: 1,
      },
    ],
    NOW
  );
  assert.equal(classified.official.pricing.monthly, 19, "pricing is a legitimate official fact");
  assert.deepEqual(classified.official.platforms, ["web", "api"]);
  assert.equal(classified.hasIndependent, false, "but it establishes no reputation");
});

test("core rule — a non-independent adapter cannot be registered", () => {
  const rogue = {
    id: "trustpilot",
    label: "rogue",
    independence: "vendor",
    policy: PROVIDER_TERMS.trustpilot.storage,
  } as unknown as ReviewSourceAdapter;

  assert.throws(() => assertIndependentProvider(rogue), /not marked independent/);
  assert.throws(
    () => new ReviewService({ adapters: [rogue], categoryAverage: () => 0.8 }),
    /not marked independent/
  );
});

// ─── Entity matching (Part 4) ────────────────────────────────────────────────

test("matching — a confirmed domain yields a high-confidence match", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const match = await adapter.matchEntity(ent(), ctx());

  assert.equal(match.matched, true);
  if (!match.matched) return;
  assert.equal(match.method, "verified-domain");
  assert.equal(match.providerEntityId, "bu-matomo-1");
  assert.ok(match.confidence >= MIN_RANKING_MATCH_CONFIDENCE);
  assert.ok(match.signals.some((s) => /confirms matomo\.org/.test(s)));
});

test("matching — a unit whose website disagrees scores lower", async () => {
  const mismatched = { ...MATOMO_UNIT, websiteUrl: "https://somethingelse.example" };
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(mismatched), now: () => NOW });
  const match = await adapter.matchEntity(ent(), ctx());

  assert.equal(match.matched, true);
  if (!match.matched) return;
  assert.equal(match.method, "official-website");
  assert.ok(match.confidence < 0.97, "an unconfirmed domain must score below a confirmed one");
});

test("matching — no provider record yields not-found, not a guess", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(null), now: () => NOW });
  const match = await adapter.matchEntity(ent(), ctx());
  assert.equal(match.matched, false);
  if (match.matched) return;
  assert.equal(match.reason, "not-found");
});

test("matching — a low-confidence match cannot influence ranking", () => {
  const low: ReviewEntityMatch = {
    matched: true,
    provider: "trustpilot",
    providerEntityId: "x",
    providerUrl: "https://example.com",
    method: "name-only",
    confidence: 0.3,
    signals: ["name resemblance"],
  };
  assert.equal(canInfluenceRanking(low), false);

  const source = normalizeSource(aggregate({ matchConfidence: 0.3 }), 0.8, NOW);
  assert.equal(source.weight, 0, "a low-confidence source carries zero weight");
  assert.equal(source.excludedFromRanking, true);
  assert.ok(source.exclusionReason);
});

test("matching — name-only is below every usable threshold by construction", () => {
  assert.ok(
    MATCH_METHOD_CONFIDENCE["name-only"] < MIN_RANKING_MATCH_CONFIDENCE,
    "similar names alone must never be sufficient"
  );
});

test("matching — an entity with no domain is unsupported", () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT) });
  assert.equal(adapter.supports(ent({ officialDomain: "" }), ctx()), false);
});

// ─── Normalization (Parts 5–6) ───────────────────────────────────────────────

test("normalization — scales are converted, never assumed", () => {
  assert.equal(normalizeScale(4, 5), 0.8);
  assert.equal(normalizeScale(8, 10), 0.8);
  assert.equal(normalizeScale(80, 100), 0.8);
  assert.equal(normalizeScale(null, 5), null);
  assert.equal(normalizeScale(4, null), null);
  assert.equal(normalizeScale(4, 0), null);
});

test("normalization — a 5.0 from 3 reviews does NOT beat a 4.7 from thousands", () => {
  const thin = normalizeSource(aggregate({ rating: 5, ratingScale: 5, reviewCount: 3 }), 0.8, NOW);
  const deep = normalizeSource(aggregate({ rating: 4.7, ratingScale: 5, reviewCount: 5_000 }), 0.8, NOW);

  assert.ok(
    deep.adjusted! > thin.adjusted!,
    `expected deep (${deep.adjusted}) > thin (${thin.adjusted}) after shrinkage`
  );
  assert.ok(deep.weight > thin.weight, "and the deep source must also carry more weight");
});

test("normalization — shrinkage pulls a thin rating toward the prior", () => {
  const thin = normalizeSource(aggregate({ rating: 5, ratingScale: 5, reviewCount: 2 }), 0.8, NOW);
  assert.ok(thin.rawNormalized === 1, "raw is 1.0");
  assert.ok(thin.adjusted! < 0.9, `adjusted ${thin.adjusted} should be pulled well below raw`);
});

test("normalization — volume confidence is log-scaled and saturates", () => {
  assert.equal(volumeConfidence(0), 0);
  assert.ok(volumeConfidence(10) < volumeConfidence(100));
  assert.ok(volumeConfidence(100) < volumeConfidence(1000));
  assert.ok(volumeConfidence(1_000_000) <= 1);
});

test("normalization — recency decays old reviews", () => {
  const recent = recencyWeight(NOW.toISOString(), NOW);
  const oneYear = recencyWeight(new Date(NOW.getTime() - 365 * 86_400_000).toISOString(), NOW);
  const threeYears = recencyWeight(new Date(NOW.getTime() - 3 * 365 * 86_400_000).toISOString(), NOW);

  assert.ok(recent > oneYear && oneYear > threeYears);
  assert.ok(Math.abs(oneYear - 0.5) < 0.01, "one half-life should be ~0.5");
});

test("normalization — an implausible all-5-star distribution is penalized", () => {
  const suspicious = aggregate({
    reviewCount: 500,
    distribution: { 1: 2, 2: 1, 3: 1, 4: 3, 5: 493 },
  });
  const { penalty, reason } = suspicionPenalty(suspicious);
  assert.ok(penalty > 0);
  assert.ok(reason);
});

test("normalization — a healthy distribution is NOT penalized", () => {
  const healthy = aggregate({
    reviewCount: 1240,
    distribution: { 1: 40, 2: 30, 3: 80, 4: 300, 5: 790 },
  });
  assert.equal(suspicionPenalty(healthy).penalty, 0, "genuinely good products must not be punished");
});

test("normalization — small samples are never flagged as suspicious", () => {
  const tiny = aggregate({ reviewCount: 5, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 5 } });
  assert.equal(suspicionPenalty(tiny).penalty, 0);
});

// ─── Multi-source (Part 8) ───────────────────────────────────────────────────

test("multi-source — sources are preserved individually, never collapsed", () => {
  const rep = combineReputation(
    [
      aggregate({ provider: "trustpilot", rating: 4.5, reviewCount: 800 }),
      aggregate({ provider: "g2", rating: 4.2, reviewCount: 400, providerUrl: "https://g2.com/x" }),
    ],
    0.8,
    NOW
  );
  assert.equal(rep.sources.length, 2);
  assert.equal(rep.contributingSources, 2);
  assert.ok(rep.overall !== null);
});

test("multi-source — disagreement is surfaced, not averaged away", () => {
  const rep = combineReputation(
    [
      aggregate({ provider: "trustpilot", rating: 4.9, reviewCount: 900 }),
      aggregate({ provider: "g2", rating: 2.1, reviewCount: 900, providerUrl: "https://g2.com/x" }),
    ],
    0.8,
    NOW
  );
  assert.ok(rep.crossSourceAgreement !== null);
  assert.ok(rep.crossSourceAgreement! < AGREEMENT_THRESHOLD);
  assert.equal(rep.sourcesDisagree, true);
  assert.ok(rep.notes.some((n) => /disagree/i.test(n)));
});

test("multi-source — agreement is high when sources concur", () => {
  const rep = combineReputation(
    [
      aggregate({ provider: "trustpilot", rating: 4.4, reviewCount: 900 }),
      aggregate({ provider: "g2", rating: 4.5, reviewCount: 900, providerUrl: "https://g2.com/x" }),
    ],
    0.8,
    NOW
  );
  assert.ok(rep.crossSourceAgreement! >= AGREEMENT_THRESHOLD);
  assert.equal(rep.sourcesDisagree, false);
  assert.equal(rep.strength, "strong");
});

test("multi-source — an excluded source is reported but contributes nothing", () => {
  const rep = combineReputation(
    [
      aggregate({ provider: "trustpilot", rating: 4.5, reviewCount: 800 }),
      aggregate({ provider: "yelp", rating: 1.0, reviewCount: 5, matchConfidence: 0.3, providerUrl: "https://yelp.com/x" }),
    ],
    0.8,
    NOW
  );
  assert.equal(rep.sources.length, 2, "both are visible");
  assert.equal(rep.contributingSources, 1, "only one counts");
  assert.ok(rep.notes.some((n) => /yelp/.test(n)));
});

test("multi-source — no usable source yields null, never a fabricated number", () => {
  const rep = combineReputation([], 0.8, NOW);
  assert.equal(rep.overall, null);
  assert.equal(rep.strength, "none");
  assert.ok(rep.notes.length > 0);
});

// ─── Availability (Part 2) ───────────────────────────────────────────────────

test("availability — missing credentials return a typed state with the owner action", () => {
  const adapter = new TrustpilotAdapter({ env: UNKEYED });
  const a = adapter.availability(UNKEYED);
  assert.equal(a.available, false);
  if (a.available) return;
  assert.equal(a.reason, "missing-credentials");
  assert.ok(a.requiredAction?.includes("TRUSTPILOT_API_KEY"));
});

test("availability — no credentials means no reviews are invented", async () => {
  const service = buildReviewService({ env: UNKEYED });
  const result = await service.gather(ent(), ctx(UNKEYED));

  assert.equal(result.anyProviderChecked, false);
  assert.equal(result.reputation.overall, null);
  assert.equal(result.attributions.length, 0);
  assert.ok(
    result.reputation.notes.some((n) => /unknown, not absent/i.test(n)),
    "unchecked must not read as 'no reviews exist'"
  );
  assert.ok(result.requiredActions.length > 0);
});

test("availability — a provider outage is distinguished from a genuine absence", async () => {
  const service = new ReviewService({
    adapters: [new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(null), now: () => NOW })],
    categoryAverage: () => 0.8,
  });
  const result = await service.gather(ent(), ctx());

  assert.equal(result.anyProviderChecked, true, "the provider DID run");
  assert.equal(result.providerOutcomes[0].checkedAndAbsent, true, "and genuinely found nothing");
});

test("availability — capabilities report what is missing and how to fix it", () => {
  const service = buildReviewService({ env: UNKEYED });
  const caps = service.capabilities(UNKEYED);
  assert.equal(caps.available.length, 0);
  assert.equal(caps.unavailable[0].provider, "trustpilot");
  assert.ok(caps.unavailable[0].requiredAction);
});

// ─── Attribution + storage (Parts 2, 10) ─────────────────────────────────────

test("attribution — a fetched aggregate carries everything the provider requires", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const match = await adapter.matchEntity(ent(), ctx());
  const agg = await adapter.fetchAggregate(match, ctx());

  assert.ok(agg);
  assert.equal(agg!.attribution.providerName, "Trustpilot");
  assert.equal(agg!.attribution.requiresBacklink, true);
  assert.equal(agg!.attribution.requiresNewTab, true);
  assert.ok(agg!.attribution.requiredText);
  assert.ok(agg!.attribution.sourceUrl.startsWith("https://www.trustpilot.com/"));
  assert.equal(agg!.attribution.retrievedAt, NOW.toISOString());
});

test("attribution — the logo is a key, never a hotlinked provider URL", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const agg = await adapter.fetchAggregate(await adapter.matchEntity(ent(), ctx()), ctx());
  assert.equal(agg!.attribution.providerLogoKey, "trustpilot");
  assert.ok(!agg!.attribution.providerLogoKey!.startsWith("http"));
});

test("storage — policy metadata travels with the record and sets an expiry", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const agg = await adapter.fetchAggregate(await adapter.matchEntity(ent(), ctx()), ctx());

  assert.equal(agg!.storage.mayStoreAggregate, true);
  assert.equal(agg!.storage.mayStoreReviewText, false, "the public tier forbids retaining review text");
  assert.equal(agg!.storage.honorsDeletion, true);
  assert.equal(agg!.storage.maxRetentionDays, 30);
  assert.ok(agg!.storage.expiresAt, "a retention limit must produce a concrete expiry");
});

test("storage — expiry is derived from the retention window", () => {
  const expires = expiryFor({ mayStoreAggregate: true, mayStoreReviewText: false, mayStoreDerivedTopics: true, maxRetentionDays: 30, honorsDeletion: true }, NOW.toISOString());
  assert.equal(expires, new Date(NOW.getTime() + 30 * 86_400_000).toISOString());
});

test("terms — no review text is retained where the provider forbids it", async () => {
  const adapter: ReviewSourceAdapter = new TrustpilotAdapter({
    env: KEYED,
    fetchImpl: stubFetch(MATOMO_UNIT),
    now: () => NOW,
  });
  // Not implemented precisely because the tier forbids text retention.
  assert.equal(adapter.fetchReviewEvidence, undefined);
  const agg = await adapter.fetchAggregate(await adapter.matchEntity(ent(), ctx()), ctx());
  assert.deepEqual(agg!.topics, [], "no topics may be fabricated from a rating alone");
});

// ─── No fake adapters, no scraping ───────────────────────────────────────────

test("providers — unimplemented providers have NO adapter", () => {
  const adapters = buildReviewAdapters({ env: KEYED });
  assert.deepEqual(adapters.map((a) => a.id), ["trustpilot"]);
  assert.ok(pendingProviders().length > 0, "the rest are documented, not stubbed");
  assert.deepEqual(implementedProviders().map((p) => p.id), ["trustpilot"]);
});

test("providers — every provider documents its compliance facts", () => {
  for (const terms of Object.values(PROVIDER_TERMS)) {
    for (const field of [
      "authentication", "termsLimitations", "attributionRequirements",
      "reviewTextRetention", "displayRequirements", "rateLimits",
      "deletionObligations", "geographicCoverage", "dataFreshness", "requiredAction",
    ] as const) {
      assert.ok(terms[field] && String(terms[field]).length > 0, `${terms.id} is missing ${field}`);
    }
  }
});

test("providers — access is by official API or licence, never scraping", () => {
  for (const terms of Object.values(PROVIDER_TERMS)) {
    assert.ok(
      ["official-api", "licensed-feed", "permitted-public-api", "none"].includes(terms.accessMethod),
      `${terms.id} must not use an unapproved access method`
    );
  }
});

test("providers — credentialed detection is accurate", () => {
  assert.deepEqual(credentialedProviders(UNKEYED), []);
  assert.deepEqual(credentialedProviders(KEYED), ["trustpilot"]);
});

// ─── Ranking integration (Part 9) ────────────────────────────────────────────

test("ranking — review evidence enters only through approved fields", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const service = new ReviewService({ adapters: [adapter], categoryAverage: () => 0.8 });
  const records = toEvidenceRecords(await service.gather(ent(), ctx()));

  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.sourceType, "trustpilot");
  assert.equal(record.rating, 4.3);
  assert.equal(record.reviewCount, 1240);
  // The critical separation: reviews assert reputation, never product facts.
  assert.deepEqual(record.attributes, {}, "review evidence must not carry product attributes");
});

test("ranking — a low-confidence match produces NO evidence record at all", async () => {
  const weakAdapter: ReviewSourceAdapter = {
    id: "trustpilot",
    label: "weak",
    independence: "independent",
    policy: PROVIDER_TERMS.trustpilot.storage,
    availability: () => ({ available: true }),
    supports: () => true,
    async matchEntity() {
      return {
        matched: true,
        provider: "trustpilot",
        providerEntityId: "x",
        providerUrl: "https://www.trustpilot.com/review/x",
        method: "name-only",
        confidence: 0.3,
        signals: [],
      };
    },
    async fetchAggregate() {
      return aggregate({ matchConfidence: 0.3, rating: 5, reviewCount: 10_000 });
    },
  };

  const service = new ReviewService({ adapters: [weakAdapter], categoryAverage: () => 0.8 });
  const records = toEvidenceRecords(await service.gather(ent(), ctx()));
  assert.equal(records.length, 0, "an unreliable match must not reach the ranking engine by any path");
});

test("ranking — review evidence classifies as independent, official does not", () => {
  const reviewRecord: Evidence = {
    sourceType: "trustpilot",
    sourceUrl: "https://www.trustpilot.com/review/matomo.org",
    retrievedAt: NOW.toISOString(),
    rating: 4.3,
    ratingScale: 5,
    reviewCount: 1240,
    attributes: {},
    confidence: 0.85,
    entityMatchConfidence: 0.97,
  };
  const classified = classifyEvidence([reviewRecord], NOW);
  assert.equal(classified.hasIndependent, true);
  assert.equal(classified.hasIndependentRating, true);
  assert.ok(classified.reputation.aggregateRating !== null);
});

test("ranking — reviews cannot override a hard constraint", async () => {
  // A wildly-reviewed but over-budget option must still be excluded.
  const pricey = ent({
    id: "pricey",
    attributes: { priceMonthly: 900 },
    evidence: [
      {
        sourceType: "trustpilot",
        sourceUrl: "https://www.trustpilot.com/review/pricey",
        retrievedAt: NOW.toISOString(),
        rating: 5,
        ratingScale: 5,
        reviewCount: 50_000,
        attributes: {},
        confidence: 0.9,
        entityMatchConfidence: 1,
      },
    ],
  });

  const repo = new FixtureEntityRepository([pricey]);
  const o = new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [],
    availabilityProbe: async () => 1,
    now: () => NOW,
    env: UNKEYED,
  });

  const res = await o.search({ query: "analytics tool under $10" });
  assert.equal(res.status, "no-results", "great reviews never buy past a hard constraint");
});

// ─── End-to-end through the pipeline ─────────────────────────────────────────

test("pipeline — review data reaches the response with attribution attached", async () => {
  const adapter = new TrustpilotAdapter({ env: KEYED, fetchImpl: stubFetch(MATOMO_UNIT), now: () => NOW });
  const service = new ReviewService({ adapters: [adapter], categoryAverage: () => 0.8 });

  const entityCache = new Map<string, Entity>();
  const reviewSource = new ReviewEvidenceSource(service, () => entityCache);

  const repo = new FixtureEntityRepository([ent()]);
  const o = new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [reviewSource],
    entityCache,
    availabilityProbe: async () => 1,
    now: () => NOW,
    env: KEYED,
  });

  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;

  const top = res.results[0];
  assert.ok(top.reviewSummary, "an independently-reviewed result must carry a review summary");
  assert.equal(top.reviewSummary!.reviewCount, 1240);
  assert.equal(top.reviewSummary!.sourcesDisagree, false);

  const attribution = top.reviewSummary!.attributions[0];
  assert.ok(attribution, "attribution must reach the frontend");
  assert.equal(attribution.providerName, "Trustpilot");
  assert.equal(attribution.requiresBacklink, true);
  assert.ok(attribution.sourceUrl.includes("trustpilot.com"));
  assert.equal(attribution.rating, 4.3);
  assert.equal(attribution.ratingScale, 5);

  assert.equal(res.evidenceCoverage.withIndependentReviews, 1);
  assert.equal(res.evidenceCoverage.withRatings, 1);
});

test("pipeline — with no review credentials, no rating widget is produced", async () => {
  const entityCache = new Map<string, Entity>();
  const reviewSource = new ReviewEvidenceSource(buildReviewService({ env: UNKEYED }), () => entityCache);

  const repo = new FixtureEntityRepository([ent()]);
  const o = new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [reviewSource],
    entityCache,
    availabilityProbe: async () => 1,
    now: () => NOW,
    env: UNKEYED,
  });

  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.results[0].reviewSummary, undefined, "no independent source → no review summary");
  assert.equal(res.evidenceCoverage.withRatings, 0);
  assert.ok(res.warnings.some((w) => /no independent review data/i.test(w)));
});
