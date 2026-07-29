import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runLocalDiscovery,
  getConfiguredProvider,
  localQuerySchema,
  locationInputSchema,
  coordinatesSchema,
  requiresExplicitConsent,
  type LocalDiscoveryProvider,
  type LocalCandidate,
} from "./contracts";

const PLACE_QUERY = {
  query: "quiet coffee shop with outlets",
  location: { kind: "place" as const, value: { text: "Nob Hill, San Francisco" } },
  radiusMeters: 2000,
  maxResults: 10,
};

function fakeProvider(over: Partial<LocalDiscoveryProvider> = {}): LocalDiscoveryProvider {
  const candidate: LocalCandidate = {
    providerId: "test-provider",
    externalId: "abc",
    name: "Marigold Coffee",
    categoryHint: "cafe",
    coordinates: { latitude: 37.79, longitude: -122.41 },
    distanceMeters: 420,
    address: "1 Example St",
    hours: null,
    openNow: true,
    priceLevel: 2,
    rating: 4.5,
    ratingScale: 5,
    reviewCount: 180,
    amenities: ["outlets", "wifi"],
    accessibility: ["step-free"],
    sourceUrl: "https://provider.example/place/abc",
  };
  return {
    metadata: {
      id: "test-provider",
      displayName: "Test Provider",
      attribution: { requiredText: "Data © Test Provider", requiredUrl: "https://provider.example", mustDisplay: true },
      retention: { maxCacheSeconds: 3600, idsOnly: false, prohibitsPersistence: true, notes: "Cache ≤1h; no permanent storage." },
      supportedCategories: ["local-cafes"],
    },
    async geocode() {
      return { latitude: 37.79, longitude: -122.41 };
    },
    async findNearby() {
      return [candidate];
    },
    ...over,
  };
}

// ─── No provider = honest unsupported, never a software fallback ─────────────

test("local — no configured provider ships by default", () => {
  assert.equal(getConfiguredProvider(), null, "no provider until the owner approves terms + credentials");
});

test("local — with no provider the result is unsupported with zero candidates", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), null);
  assert.equal(res.status, "unsupported_no_provider");
  assert.deepEqual(res.candidates, [], "must never fall back to software results");
  // The status assert above already narrows `res` to the unsupported variant.
  assert.match(res.message, /aren't available yet/i);
});

test("local — a local query never returns software entities", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), null);
  const blob = JSON.stringify(res).toLowerCase();
  for (const softwareName of ["matomo", "fathom", "plausible", "analytics-tools"]) {
    assert.ok(!blob.includes(softwareName), `software leaked into a local result: ${softwareName}`);
  }
});

// ─── Category gating ─────────────────────────────────────────────────────────

test("local — an unsupported category is rejected even with a provider", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), fakeProvider(), {
    categoryId: "analytics-tools",
  });
  assert.equal(res.status, "unsupported_category");
  assert.deepEqual(res.candidates, []);
});

// ─── Location handling ───────────────────────────────────────────────────────

test("local — typed place input works without any location permission", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), fakeProvider(), {
    categoryId: "local-cafes",
  });
  assert.equal(res.status, "ok");
  assert.equal(res.candidates.length, 1);
});

test("local — coordinates require explicit consent (unconsented payloads fail validation)", () => {
  const withConsent = {
    kind: "coordinates",
    consent: true,
    value: { latitude: 37.79, longitude: -122.41 },
  };
  assert.equal(locationInputSchema.safeParse(withConsent).success, true);
  assert.equal(requiresExplicitConsent(locationInputSchema.parse(withConsent)), true);

  // Missing or false consent is not representable.
  assert.equal(locationInputSchema.safeParse({ kind: "coordinates", value: { latitude: 1, longitude: 2 } }).success, false);
  assert.equal(
    locationInputSchema.safeParse({ kind: "coordinates", consent: false, value: { latitude: 1, longitude: 2 } }).success,
    false
  );
});

test("local — coordinates are range-validated", () => {
  assert.equal(coordinatesSchema.safeParse({ latitude: 91, longitude: 0 }).success, false);
  assert.equal(coordinatesSchema.safeParse({ latitude: 0, longitude: 181 }).success, false);
  assert.equal(coordinatesSchema.safeParse({ latitude: 37.79, longitude: -122.41 }).success, true);
});

test("local — a failed geocode is reported, not guessed around", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), fakeProvider({ async geocode() { return null; } }), {
    categoryId: "local-cafes",
  });
  assert.equal(res.status, "geocode_failed");
  assert.deepEqual(res.candidates, []);
});

// ─── Attribution + retention travel with the data ────────────────────────────

test("local — provider attribution and retention policy are part of the response contract", async () => {
  const res = await runLocalDiscovery(localQuerySchema.parse(PLACE_QUERY), fakeProvider(), {
    categoryId: "local-cafes",
  });
  assert.equal(res.status, "ok");
  if (res.status !== "ok") return;
  assert.equal(res.attribution.mustDisplay, true);
  assert.match(res.attribution.requiredText, /Test Provider/);
  assert.equal(res.retention.prohibitsPersistence, true);
  assert.equal(res.retention.maxCacheSeconds, 3600);
  assert.equal(res.providerId, "test-provider");
});

test("local — maxResults is enforced", async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ ...({} as LocalCandidate), providerId: "p", externalId: String(i), name: `P${i}`, categoryHint: null, coordinates: null, distanceMeters: null, address: null, hours: null, openNow: null, priceLevel: null, rating: null, ratingScale: null, reviewCount: null, amenities: [], accessibility: [], sourceUrl: null }));
  const res = await runLocalDiscovery(
    localQuerySchema.parse({ ...PLACE_QUERY, maxResults: 5 }),
    fakeProvider({ async findNearby() { return many; } }),
    { categoryId: "local-cafes" }
  );
  assert.equal(res.status, "ok");
  assert.equal(res.candidates.length, 5);
});

test("local — query input is validated", () => {
  assert.equal(localQuerySchema.safeParse({ ...PLACE_QUERY, query: "" }).success, false);
  assert.equal(localQuerySchema.safeParse({ ...PLACE_QUERY, radiusMeters: 999_999 }).success, false);
  assert.equal(localQuerySchema.safeParse({ ...PLACE_QUERY, location: { kind: "place", value: { text: "a" } } }).success, false);
});
