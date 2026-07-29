import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaSnapshotStore, type EvidenceSnapshotDelegate } from "./prisma-store";
import { InMemorySnapshotStore } from "./store";
import { computeFreshness, fingerprint, type EvidenceSnapshot } from "./snapshot";
import { getApprovedSource, listApprovedSources } from "./registry";
import { getPilotSeedEntity } from "./pilot";
import { mergeOfficialEvidence } from "./merge";
import { assessReadiness } from "./readiness";
import { applyConfiguredMerge } from "./enrich";
import { selectRefreshBatch, getRefreshConfig } from "./config";
import { ingestEntity } from "./service";
import { safeFetch, type FetchPolicy } from "./fetcher";
import type { LookupFn } from "./ssrf";
import { buildFixtures } from "@/features/recommendation/fixtures";
import { searchRequestSchema, searchRecommendations } from "@/features/recommendation/api";

const NOW = new Date("2026-07-20T00:00:00Z");
const PUBLIC_LOOKUP: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

function mkSnapshot(
  entityId: string,
  attrs: Record<string, string | number | boolean>,
  opts: { confidence?: number; retrievedAt?: string; ok?: boolean; errorKind?: string } = {}
): EvidenceSnapshot {
  const retrievedAt = opts.retrievedAt ?? "2026-07-19T00:00:00Z";
  const conf = opts.confidence ?? 0.9;
  const ok = opts.ok ?? true;
  return {
    id: `${entityId}:${retrievedAt}:${fingerprint(attrs).slice(0, 6)}`,
    entityId,
    adapterId: "official-site",
    primarySourceUrl: `https://${entityId}.example/`,
    retrievedAt,
    extractionVersion: "official-site@1",
    ok,
    http: { pagesFetched: ok ? 2 : 0, pagesFailed: ok ? 0 : 2, totalBytes: 10, totalDurationMs: 5 },
    contentFingerprint: fingerprint({ attrs, retrievedAt, ok }),
    attributes: ok ? attrs : {},
    pricing: { kind: "unknown", minMonthly: null, currency: null, hasFreePlan: null, hasFreeTrial: null, confidence: conf, supportingText: [] },
    provenance: ok
      ? Object.entries(attrs).map(([attribute, value]) => ({ attribute, value, method: "json-ld", sourceUrl: "https://x/pricing", sourceText: "src", confidence: conf, fingerprint: "fp" }))
      : [],
    confidence: ok ? conf : 0,
    freshnessStatus: computeFreshness(retrievedAt, NOW),
    pages: [{ url: "https://x/", ok, status: ok ? 200 : 500 }],
    warnings: [],
    error: ok ? null : { kind: opts.errorKind ?? "http_error", message: "failed" },
  };
}

// ─── Real-domain registry configuration ──────────────────────────────────────

test("registry — pilot identity + category preserved; fictional never enabled", () => {
  for (const id of ["plausible-analytics", "fathom-analytics", "matomo"]) {
    const s = getApprovedSource(id)!;
    assert.equal(s.enabled, true);
    assert.equal(s.pilot, true);
    assert.equal(s.categoryId, "analytics-tools");
  }
  // Fictional seeds are disabled and never treated as official evidence.
  for (const id of ["glyph-code", "tally-metrics", "northwind-analytics"]) {
    assert.equal(getApprovedSource(id)!.enabled, false);
  }
  assert.ok(listApprovedSources().every((s) => s.pilot));
});

test("registry — an off-origin redirect from a pilot origin is rejected", async () => {
  const policy: FetchPolicy = { approvedOrigins: ["https://plausible.io"] };
  const r = await safeFetch("https://plausible.io/", policy, {
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://tracker.example/x" } }),
    lookup: PUBLIC_LOOKUP,
  });
  assert.ok(!r.ok && r.error.kind === "blocked_origin");
});

// ─── Prisma store (hermetic fake delegate) ───────────────────────────────────

interface FakeArgs {
  where?: Record<string, unknown>;
  take?: number;
  distinct?: string[];
}

class FakeDelegate {
  rows: Record<string, unknown>[] = [];
  async create({ data }: { data: Record<string, unknown> }) {
    if (this.rows.some((r) => r.entityId === data.entityId && r.contentFingerprint === data.contentFingerprint)) {
      throw Object.assign(new Error("unique"), { code: "P2002" });
    }
    this.rows.push({ ...data });
    return data;
  }
  private filtered(where: Record<string, unknown> | undefined) {
    let rs = [...this.rows];
    if (where?.entityId) rs = rs.filter((r) => r.entityId === where.entityId);
    if (where?.ok !== undefined) rs = rs.filter((r) => r.ok === where.ok);
    rs.sort((a, b) => (b.retrievedAt as Date).getTime() - (a.retrievedAt as Date).getTime());
    return rs;
  }
  async findFirst(args: FakeArgs) {
    return this.filtered(args?.where)[0] ?? null;
  }
  async findMany(args: FakeArgs) {
    let rs = this.filtered(args?.where);
    if (args?.distinct?.includes("entityId")) {
      const seen = new Set<unknown>();
      rs = rs.filter((r) => (seen.has(r.entityId) ? false : (seen.add(r.entityId), true)));
    }
    if (args?.take) rs = rs.slice(0, args.take);
    return rs;
  }
}

test("prisma-store — insert, dedup, latest-valid, failed-attempt, history, no raw HTML", async () => {
  const fake = new FakeDelegate();
  const store = new PrismaSnapshotStore(fake as unknown as EvidenceSnapshotDelegate);

  const s1 = mkSnapshot("e1", { priceMonthly: 9 }, { retrievedAt: "2026-07-10T00:00:00Z" });
  await store.append(s1);
  await store.append(s1); // identical fingerprint → dedup (P2002 swallowed)
  assert.equal(fake.rows.length, 1);

  // A failed attempt is persisted but does not become the latest VALID.
  const failed = mkSnapshot("e1", {}, { ok: false, retrievedAt: "2026-07-15T00:00:00Z", errorKind: "http_error" });
  await store.append(failed);
  const s2 = mkSnapshot("e1", { priceMonthly: 12 }, { retrievedAt: "2026-07-18T00:00:00Z" });
  await store.append(s2);

  assert.equal(new Date((await store.latest("e1"))!.retrievedAt).getTime(), new Date(s2.retrievedAt).getTime());
  assert.equal((await store.latestValid("e1"))!.attributes.priceMonthly, 12);
  assert.equal((await store.history("e1")).length, 3);

  // No raw HTML is persisted (only hashes + short excerpts).
  const blob = JSON.stringify(fake.rows);
  assert.ok(!/<html|<body|<script/i.test(blob));
});

// ─── Readiness ───────────────────────────────────────────────────────────────

function readinessFor(seedId: string, snap: EvidenceSnapshot | null): ReturnType<typeof assessReadiness> {
  const seed = getPilotSeedEntity(seedId) ?? buildFixtures(NOW).find((e) => e.id === seedId)!;
  const latestValid = snap && snap.ok ? snap : null;
  const merge = mergeOfficialEvidence(seed, latestValid, { now: NOW });
  return assessReadiness({ source: getApprovedSource(seedId) ?? null, latest: snap, latestValid, merge });
}

test("readiness — fresh, full, confident official evidence → ready", () => {
  const snap = mkSnapshot("plausible-analytics", { priceMonthly: 9, hasFreePlan: false, platforms: "web,api" });
  assert.equal(readinessFor("plausible-analytics", snap).verdict, "ready");
});

test("readiness — missing a critical ranking field → mixed, not ready", () => {
  const snap = mkSnapshot("plausible-analytics", { priceMonthly: 9 }); // no hasFreePlan/platforms
  assert.equal(readinessFor("plausible-analytics", snap).verdict, "mixed");
});

test("readiness — a stale snapshot blocks readiness", () => {
  const snap = mkSnapshot("plausible-analytics", { priceMonthly: 9, hasFreePlan: false, platforms: "web" }, { retrievedAt: "2025-01-01T00:00:00Z" });
  assert.equal(readinessFor("plausible-analytics", snap).verdict, "stale");
});

test("readiness — a fresh low-confidence conflict blocks readiness", () => {
  const seed = buildFixtures(NOW).find((e) => e.id === "tally-metrics")!; // priceMonthly 9
  const snap = mkSnapshot("tally-metrics", { priceMonthly: 25 }, { confidence: 0.3 }); // fresh but low conf, conflicts
  const merge = mergeOfficialEvidence(seed, snap, { now: NOW });
  const r = assessReadiness({ source: getApprovedSource("tally-metrics") ?? null, latest: snap, latestValid: snap, merge });
  assert.equal(r.verdict, "blocked-by-conflict");
});

test("readiness — robots/ingestion failure with no valid snapshot → ingestion-failed", () => {
  const failed = mkSnapshot("matomo", {}, { ok: false, errorKind: "robots_blocked" });
  assert.equal(readinessFor("matomo", failed).verdict, "ingestion-failed");
});

test("readiness — not ingested at all → not-ingested", () => {
  assert.equal(readinessFor("matomo", null).verdict, "not-ingested");
});

// ─── Merge gating ────────────────────────────────────────────────────────────

test("merge-gating — no scope configured → corpus unchanged", async () => {
  const store = new InMemorySnapshotStore();
  const out = await applyConfiguredMerge(buildFixtures(NOW), store, {} as NodeJS.ProcessEnv, NOW);
  assert.equal(out.corpus.length, buildFixtures(NOW).length);
  assert.equal(out.evidenceMode, undefined);
});

test("merge-gating — entity allowlist + ready snapshot injects the pilot with official facts", async () => {
  const store = new InMemorySnapshotStore();
  await store.append(mkSnapshot("plausible-analytics", { priceMonthly: 9, hasFreePlan: false, platforms: "web,api" }));
  const env = { NODE_ENV: "development", INGESTION_MERGE_ENTITIES: "plausible-analytics" } as NodeJS.ProcessEnv;
  const out = await applyConfiguredMerge(buildFixtures(NOW), store, env, NOW);
  const plausible = out.corpus.find((e) => e.id === "plausible-analytics");
  assert.ok(plausible, "ready pilot should be injected");
  assert.equal(plausible!.attributes.priceMonthly, 9);
  assert.equal(plausible!.categoryId, "analytics-tools"); // isolation preserved
  // Ratings are never fabricated by official evidence.
  assert.ok(plausible!.evidence.every((ev) => ev.rating === null));
});

test("merge-gating — category allowlist works; unready entity stays seeded (warned)", async () => {
  const store = new InMemorySnapshotStore();
  // Stale snapshot → not ready → not applied.
  await store.append(mkSnapshot("plausible-analytics", { priceMonthly: 9, hasFreePlan: false, platforms: "web" }, { retrievedAt: "2025-01-01T00:00:00Z" }));
  const env = { NODE_ENV: "development", INGESTION_MERGE_CATEGORIES: "analytics-tools" } as NodeJS.ProcessEnv;
  const out = await applyConfiguredMerge(buildFixtures(NOW), store, env, NOW);
  assert.ok(!out.corpus.find((e) => e.id === "plausible-analytics"), "stale pilot not injected");
  assert.ok(out.warnings.some((w) => /plausible-analytics/.test(w)));
});

test("merge-gating — a non-allowlisted entity is never merged", async () => {
  const store = new InMemorySnapshotStore();
  await store.append(mkSnapshot("fathom-analytics", { priceMonthly: 15, hasFreePlan: false, platforms: "web" }));
  const env = { NODE_ENV: "development", INGESTION_MERGE_ENTITIES: "plausible-analytics" } as NodeJS.ProcessEnv; // fathom NOT listed
  const out = await applyConfiguredMerge(buildFixtures(NOW), store, env, NOW);
  assert.ok(!out.corpus.find((e) => e.id === "fathom-analytics"));
});

// ─── Scheduled refresh selection + disabled skip ─────────────────────────────

test("cron — batch selection respects limit, category filter, and cursor pagination", () => {
  const cfg = { batchSize: 2, categories: ["analytics-tools"] };
  const sources = listApprovedSources(); // 3 analytics pilots
  const page1 = selectRefreshBatch(sources, null, cfg);
  assert.equal(page1.batch.length, 2);
  assert.ok(page1.nextCursor);
  const page2 = selectRefreshBatch(sources, page1.nextCursor, cfg);
  assert.equal(page2.batch.length, 1);
  assert.equal(page2.nextCursor, null);
  // A category with no enabled entities selects nothing (never touches unsupported).
  assert.equal(selectRefreshBatch(sources, null, { batchSize: 5, categories: ["hosting-platforms"] }).batch.length, 0);
});

test("cron — a disabled entity is skipped by the ingestion service", async () => {
  const store = new InMemorySnapshotStore();
  const r = await ingestEntity("glyph-code", { store, now: NOW }); // disabled fictional
  assert.equal(r.requested, 0);
});

test("cron — refresh config reads env with safe defaults", () => {
  const cfg = getRefreshConfig({ NODE_ENV: "development", INGESTION_REFRESH_BATCH: "3", INGESTION_REFRESH_STALE_MS: "1000" } as NodeJS.ProcessEnv);
  assert.equal(cfg.batchSize, 3);
  assert.equal(cfg.stalenessThresholdMs, 1000);
  assert.equal(getRefreshConfig({} as NodeJS.ProcessEnv).batchSize, 5); // default
});

// ─── Public recommendation never starts ingestion (default) ──────────────────

test("no-crawl — search with no merge configured never enriches", async () => {
  const prev = process.env.INGESTION_MERGE_CATEGORIES;
  delete process.env.INGESTION_MERGE_CATEGORIES;
  delete process.env.INGESTION_MERGE;
  const res = await searchRecommendations(searchRequestSchema.parse({ query: "analytics tool" }), { now: NOW, env: { NODE_ENV: "development" } as NodeJS.ProcessEnv });
  assert.equal(res.status, "success");
  if (res.status === "success") assert.equal(res.diagnostics?.evidenceMode, undefined);
  if (prev) process.env.INGESTION_MERGE_CATEGORIES = prev;
});
