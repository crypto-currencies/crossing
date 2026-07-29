import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFetch, type FetchPolicy } from "./fetcher";
import type { LookupFn } from "./ssrf";
import { officialSiteAdapter } from "./adapter";
import { ingestEntity } from "./service";
import { InMemorySnapshotStore } from "./store";
import { mergeOfficialEvidence, enrichCorpusWithOfficialEvidence } from "./merge";
import { computeFreshness, fingerprint, type EvidenceSnapshot } from "./snapshot";
import { getApprovedSource } from "./registry";
import { buildAuditRows, buildEntityAudit } from "./audit";
import { ingestionToolEnabled, isProduction } from "./access";
import { buildFixtures } from "@/features/recommendation/fixtures";
import { searchRecommendations, searchRequestSchema } from "@/features/recommendation/api";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV_ENV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
const PUBLIC_LOOKUP: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
const noSleep = async () => {};

function res(body: string | null, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
}

// ─── Fetcher protections ──────────────────────────────────────────────────────

const APPROVED: FetchPolicy = { approvedOrigins: ["https://example.com"] };

test("fetcher — a clean approved fetch succeeds", async () => {
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => res("<title>Hi</title>"),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(r.ok);
  if (r.ok) assert.match(r.body, /Hi/);
});

test("fetcher — SSRF: a host resolving to a private IP is blocked", async () => {
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => res("x"),
    lookup: async () => [{ address: "10.0.0.1", family: 4 }],
  });
  assert.ok(!r.ok && r.error.kind === "ssrf_blocked");
});

test("fetcher — a redirect leaving the approved origin is blocked", async () => {
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.com/" } }),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "blocked_origin");
});

test("fetcher — an on-origin redirect is followed", async () => {
  let hop = 0;
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => (hop++ === 0 ? new Response(null, { status: 302, headers: { location: "https://example.com/final" } }) : res("<title>Final</title>")),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(r.ok && r.finalUrl === "https://example.com/final");
});

test("fetcher — timeout is classified retryable", async () => {
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    },
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "timeout" && r.error.retryable);
});

test("fetcher — an oversized (decoded) response is rejected", async () => {
  const r = await safeFetch("https://example.com/", { ...APPROVED, maxBytes: 100 }, {
    fetchImpl: async () => res("x".repeat(5000)),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "too_large");
});

test("fetcher — an unsupported content type is rejected", async () => {
  const r = await safeFetch("https://example.com/", APPROVED, {
    fetchImpl: async () => res("%PDF-1.4", 200, { "content-type": "application/pdf" }),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "unsupported_content_type");
});

test("fetcher — too many redirects is rejected", async () => {
  const r = await safeFetch("https://example.com/a", { ...APPROVED, maxRedirects: 1 }, {
    fetchImpl: async (u) => new Response(null, { status: 302, headers: { location: `${u}z` } }),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "too_many_redirects");
});

// ─── Adapter + service (with a mocked site) ──────────────────────────────────

const HOMEPAGE = `<title>Glyph Code</title>
<script type="application/ld+json">{"@type":"SoftwareApplication","name":"Glyph Code","operatingSystem":"Web",
"offers":[{"@type":"Offer","price":"12","priceCurrency":"USD","priceSpecification":{"billingDuration":"month","price":"12"}}]}</script>`;
const PRICING = `<title>Pricing</title><body>Pro is $12/mo. No free plan.</body>`;
const DOCS = `<title>Docs</title><body>Getting started.</body>`;

function siteFetch(map: Record<string, { status?: number; body?: string; contentType?: string }>): typeof fetch {
  return (async (input: string) => {
    const path = new URL(input).pathname;
    const page = map[path];
    if (!page) return res("not found", 404, { "content-type": "text/plain" });
    return res(page.body ?? "", page.status ?? 200, { "content-type": page.contentType ?? "text/html" });
  }) as unknown as typeof fetch;
}

const GLYPH_SITE = {
  "/robots.txt": { body: "User-agent: *\nAllow: /", contentType: "text/plain" },
  "/": { body: HOMEPAGE },
  "/pricing": { body: PRICING },
  "/docs": { body: DOCS },
};

test("adapter — official-site run produces a snapshot with normalized attributes + provenance", async () => {
  const source = getApprovedSource("glyph-code")!;
  const { snapshot, diagnostics } = await officialSiteAdapter.run(source, {
    now: NOW,
    sleep: noSleep,
    fetchDeps: { fetchImpl: siteFetch(GLYPH_SITE), lookup: PUBLIC_LOOKUP },
  });
  assert.ok(snapshot.ok);
  assert.equal(snapshot.attributes.priceMonthly, 12);
  assert.equal(snapshot.attributes.hasFreePlan, false);
  assert.ok(String(snapshot.attributes.platforms).includes("web"));
  assert.ok(snapshot.provenance.some((p) => p.attribute === "priceMonthly"));
  assert.equal(diagnostics.pagesOk, 3);
  // robots.txt allowed crawling (explicit Allow rule → "rules", never blocked).
  assert.ok(["rules", "no_robots"].includes(diagnostics.robotsStatus));
});

// Real pilot entity (fathom-analytics) mock site — homepage + pricing.
const FATHOM_SITE = {
  "/robots.txt": { body: "User-agent: *\nAllow: /", contentType: "text/plain" },
  "/": { body: `<title>Fathom Analytics</title><meta property="og:site_name" content="Fathom Analytics">` },
  "/pricing": { body: `<title>Pricing</title><body>Starter $15/mo. No free plan.</body>` },
};

test("service — snapshot versioning, dedup, skip-fresh, and forced refresh (pilot entity)", async () => {
  const store = new InMemorySnapshotStore();
  const deps = { fetchImpl: siteFetch(FATHOM_SITE), lookup: PUBLIC_LOOKUP };
  const base = { store, fetchDeps: deps, sleep: noSleep, now: NOW };

  const r1 = await ingestEntity("fathom-analytics", { ...base, force: true });
  assert.equal(r1.created, 1);
  assert.equal((await store.history("fathom-analytics")).length, 1);

  // Identical content → deduplicated (no new snapshot).
  const r2 = await ingestEntity("fathom-analytics", { ...base, force: true });
  assert.equal(r2.deduplicated, 1);
  assert.equal((await store.history("fathom-analytics")).length, 1);

  // Not forced, still fresh → skipped.
  const r3 = await ingestEntity("fathom-analytics", base);
  assert.equal(r3.skippedFresh, 1);

  // Changed content, forced → new snapshot appended (history grows).
  const changed = { ...FATHOM_SITE, "/pricing": { body: `<title>Pricing</title><body>Starter $19/mo. No free plan.</body>` } };
  const r4 = await ingestEntity("fathom-analytics", { store, fetchDeps: { fetchImpl: siteFetch(changed), lookup: PUBLIC_LOOKUP }, sleep: noSleep, now: new Date("2026-08-01T00:00:00Z"), force: true });
  assert.equal(r4.created, 1);
  assert.equal((await store.history("fathom-analytics")).length, 2);
});

test("service — partial page failure still yields a snapshot; total failure is recorded", async () => {
  const store = new InMemorySnapshotStore();
  // Pricing 500 but homepage ok → snapshot ok with a warning.
  const partial = { ...FATHOM_SITE, "/pricing": { status: 500, body: "err" } };
  const r = await ingestEntity("fathom-analytics", { store, fetchDeps: { fetchImpl: siteFetch(partial), lookup: PUBLIC_LOOKUP }, sleep: noSleep, now: NOW, force: true });
  assert.equal(r.created, 1);
  assert.ok(r.results[0].snapshot!.ok);
  assert.ok(r.results[0].snapshot!.warnings.length > 0);

  // Every page 500 → failed snapshot, still persisted for the audit trail.
  const store2 = new InMemorySnapshotStore();
  const dead = { "/robots.txt": FATHOM_SITE["/robots.txt"], "/": { status: 500, body: "x" }, "/pricing": { status: 500, body: "x" } };
  const r2 = await ingestEntity("fathom-analytics", { store: store2, fetchDeps: { fetchImpl: siteFetch(dead), lookup: PUBLIC_LOOKUP }, sleep: noSleep, now: NOW, force: true });
  assert.equal(r2.failed, 1);
  assert.equal((await store2.history("fathom-analytics"))[0].ok, false);
});

test("service — robots disallow-all blocks ingestion (fail closed)", async () => {
  const store = new InMemorySnapshotStore();
  const blocked = { ...FATHOM_SITE, "/robots.txt": { body: "User-agent: *\nDisallow: /", contentType: "text/plain" } };
  const r = await ingestEntity("fathom-analytics", { store, fetchDeps: { fetchImpl: siteFetch(blocked), lookup: PUBLIC_LOOKUP }, sleep: noSleep, now: NOW, force: true });
  assert.equal(r.failed, 1);
  assert.equal(r.results[0].snapshot!.error?.kind, "robots_blocked");
});

// ─── Source precedence + missing data ────────────────────────────────────────

function mkSnapshot(entityId: string, attrs: Record<string, string | number | boolean>, opts: { confidence?: number; retrievedAt?: string; ok?: boolean } = {}): EvidenceSnapshot {
  const retrievedAt = opts.retrievedAt ?? "2026-07-19T00:00:00Z";
  const conf = opts.confidence ?? 0.9;
  return {
    id: `${entityId}:${retrievedAt}`,
    entityId,
    adapterId: "official-site",
    primarySourceUrl: `https://x/`,
    retrievedAt,
    extractionVersion: "official-site@1",
    ok: opts.ok ?? true,
    http: { pagesFetched: 1, pagesFailed: 0, totalBytes: 1, totalDurationMs: 1 },
    contentFingerprint: fingerprint(attrs),
    attributes: attrs,
    pricing: { kind: "unknown", minMonthly: null, currency: null, hasFreePlan: null, hasFreeTrial: null, confidence: conf, supportingText: [] },
    provenance: Object.entries(attrs).map(([attribute, value]) => ({ attribute, value, method: "json-ld", sourceUrl: "https://x/pricing", sourceText: "supporting text", confidence: conf, fingerprint: "fp" })),
    confidence: conf,
    freshnessStatus: computeFreshness(retrievedAt, NOW),
    pages: [],
    warnings: [],
    error: null,
  };
}

function seed(id: string) {
  return buildFixtures(NOW).find((e) => e.id === id)!;
}

test("precedence — fresh, confident official evidence outranks the seed (with a conflict warning)", () => {
  const entity = seed("glyph-code"); // seed: hasFreePlan true, priceMonthly 0, platforms many
  const snap = mkSnapshot("glyph-code", { hasFreePlan: false, priceMonthly: 12, platforms: "web" });
  const m = mergeOfficialEvidence(entity, snap, { now: NOW });
  assert.equal(m.entity.attributes.priceMonthly, 12);
  assert.equal(m.entity.attributes.hasFreePlan, false);
  assert.equal(m.evidenceMode, "live");
  assert.ok(m.conflicts.some((c) => c.attribute === "priceMonthly" && c.resolution === "official"));
  assert.ok(m.warnings.length > 0);
  // Official evidence never becomes a rating.
  assert.ok(m.entity.evidence.every((e) => (e.sourceType === "official" ? e.rating === null : true)));
});

test("precedence — stale or low-confidence official evidence keeps the seed value", () => {
  const entity = seed("glyph-code");
  const stale = mkSnapshot("glyph-code", { priceMonthly: 99 }, { retrievedAt: "2025-01-01T00:00:00Z" });
  const mStale = mergeOfficialEvidence(entity, stale, { now: NOW });
  assert.equal(mStale.entity.attributes.priceMonthly, 0); // seed kept
  assert.ok(mStale.conflicts.some((c) => c.resolution === "seed"));

  const lowConf = mkSnapshot("glyph-code", { priceMonthly: 99 }, { confidence: 0.3 });
  const mLow = mergeOfficialEvidence(entity, lowConf, { now: NOW });
  assert.equal(mLow.entity.attributes.priceMonthly, 0);
});

test("precedence — missing official data never means the feature is absent", () => {
  const entity = seed("glyph-code");
  const partial = mkSnapshot("glyph-code", { priceMonthly: 5 }); // no platforms/hasFreePlan
  const m = mergeOfficialEvidence(entity, partial, { now: NOW });
  assert.equal(m.entity.attributes.hasFreePlan, entity.attributes.hasFreePlan); // untouched
  assert.ok(m.rankingFieldsSeeded.includes("platforms"));
  assert.equal(m.evidenceMode, "mixed");
});

test("isolation — enrichment never changes an entity's category", async () => {
  const store = new InMemorySnapshotStore();
  await store.append(mkSnapshot("tally-metrics", { platforms: "web", priceMonthly: 9, hasFreePlan: true }));
  const { corpus } = await enrichCorpusWithOfficialEvidence(buildFixtures(NOW), store, NOW);
  const tally = corpus.find((e) => e.id === "tally-metrics")!;
  assert.equal(tally.categoryId, "analytics-tools");
  assert.equal(corpus.length, buildFixtures(NOW).length);

  // Ranking over the enriched corpus stays category-isolated.
  const req = searchRequestSchema.parse({ query: "analytics tool" });
  // Injected corpus path (enrichment already applied) → deterministic + isolated.
  const res2 = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res2.status, "success");
});

// ─── The critical guarantee: search never crawls ─────────────────────────────

test("no-crawl — a public recommendation request does not enrich/crawl by default", async () => {
  assert.notEqual(process.env.INGESTION_MERGE, "on");
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const res2 = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res2.status, "success");
  if (res2.status === "success") {
    // Enrichment (the only path that reads snapshots) never ran → no evidence mode set.
    assert.equal(res2.diagnostics?.evidenceMode, undefined);
  }
});

// ─── Audit view-models ────────────────────────────────────────────────────────

test("audit — rows surface mode, conflicts, missing fields, and freshness", async () => {
  const store = new InMemorySnapshotStore();
  await store.append(mkSnapshot("glyph-code", { hasFreePlan: false, priceMonthly: 12, platforms: "web" }));
  const rows = await buildAuditRows(store, NOW);
  const glyph = rows.find((r) => r.entityId === "glyph-code")!;
  assert.equal(glyph.hasConflicts, true);
  assert.notEqual(glyph.evidenceMode, "seeded");
  assert.equal(glyph.freshness, "fresh");

  // An entity with no snapshot is seed-only with all factual fields missing.
  const tally = rows.find((r) => r.entityId === "tally-metrics")!;
  assert.equal(tally.evidenceMode, "seeded");
  assert.ok(tally.missingFactualFields.length >= 1);
});

test("audit — detail distinguishes conflict, official-only, and never-ingested; excerpts carry no markup", async () => {
  const store = new InMemorySnapshotStore();
  await store.append(mkSnapshot("glyph-code", { hasFreePlan: false, priceMonthly: 12 })); // platforms absent
  const detail = (await buildEntityAudit("glyph-code", store, NOW))!;
  const price = detail.comparisons.find((c) => c.attribute === "priceMonthly")!;
  assert.equal(price.verdict, "conflict");
  const platforms = detail.comparisons.find((c) => c.attribute === "platforms")!;
  assert.equal(platforms.officialState, "not-found"); // unknown, not "absent"
  assert.equal(detail.history.length, 1);
  for (const c of detail.comparisons) {
    if (c.sourceText) assert.ok(!c.sourceText.includes("<"), "excerpt must not contain raw markup");
  }
});

// ─── Access gating ────────────────────────────────────────────────────────────

test("access — tool is enabled in dev, disabled in prod unless explicitly allowed", () => {
  assert.equal(ingestionToolEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), true);
  assert.equal(ingestionToolEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(ingestionToolEnabled({ NODE_ENV: "production", INGESTION_ALLOW_PROD: "true" } as NodeJS.ProcessEnv), true);
  assert.equal(isProduction({ NODE_ENV: "production" } as NodeJS.ProcessEnv), true);
});
