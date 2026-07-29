import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchRecommendations,
  searchRequestSchema,
  httpStatusForResponse,
  MAX_QUERY_LENGTH,
} from "./api";
import { PrismaEntityRepository, type EntityDelegate, type PrismaEntityRow } from "../entities/repository";
import { createEvidenceLoader, type EvidenceSnapshotDelegate } from "../entities/evidence-loader";
import { setDefaultEntityRepository } from "../entities/default-repository";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV_ENV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

// ─── Request validation ──────────────────────────────────────────────────────

test("request — a valid query passes validation", () => {
  const parsed = searchRequestSchema.safeParse({ query: "best analytics tool for a small SaaS" });
  assert.equal(parsed.success, true);
});

test("request — empty query is rejected", () => {
  const parsed = searchRequestSchema.safeParse({ query: "   " });
  assert.equal(parsed.success, false);
});

test("request — a query over the length limit is rejected", () => {
  const parsed = searchRequestSchema.safeParse({ query: "x".repeat(MAX_QUERY_LENGTH + 1) });
  assert.equal(parsed.success, false);
});

test("request — an out-of-range resultCount is rejected", () => {
  assert.equal(searchRequestSchema.safeParse({ query: "hosting", resultCount: 99 }).success, false);
  assert.equal(searchRequestSchema.safeParse({ query: "hosting", resultCount: 3 }).success, true);
});

// ─── Successful search ───────────────────────────────────────────────────────

test("search — a valid analytics query returns a success state with best + alternatives", async () => {
  const req = searchRequestSchema.parse({ query: "best cheap analytics tool for a small SaaS" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV, requestId: "test-1" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.requestId, "test-1");
  assert.ok(res.bestMatch);
  assert.ok(res.alternatives.length >= 1);
  assert.equal(httpStatusForResponse(res), 200);
});

test("search — success response shape is stable and complete", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  for (const key of ["requestId", "timingMs", "dataMode", "seeded", "warnings", "parsedQuery", "bestMatch", "alternatives", "confidence", "confidenceLevel"]) {
    assert.ok(key in res, `missing ${key}`);
  }
  assert.equal(typeof res.timingMs, "number");
  assert.ok(Array.isArray(res.warnings));
});

test("search — explicit categoryId override pins the category", async () => {
  const req = searchRequestSchema.parse({ query: "something", categoryId: "hosting-platforms" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.bestMatch.categoryId, "hosting-platforms");
});

// ─── Category gate at the API boundary ───────────────────────────────────────

test("search — an unsupported local query returns unsupported-category, no software", async () => {
  const req = searchRequestSchema.parse({ query: "quiet coffee shop with outlets near me" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res.status, "unsupported-category");
  if (res.status !== "unsupported-category") return;
  assert.equal(res.category.domain, "local-business");
  assert.ok(/isn't a category|prototype/i.test(res.message));
  // No software entities anywhere in the serialized response.
  const blob = JSON.stringify(res).toLowerCase();
  for (const name of ["driftdeploy", "glyph code", "ironclad host", "tally metrics"]) {
    assert.ok(!blob.includes(name.toLowerCase()), `leaked software entity: ${name}`);
  }
});

test("search — an unknown query returns needs-clarification with suggestions", async () => {
  const req = searchRequestSchema.parse({ query: "something good for my thing" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.ok(res.status === "needs-clarification");
  if (res.status !== "needs-clarification") return;
  assert.ok(res.suggestions.length > 0);
  assert.ok(res.suggestions.every((s) => s.id && s.label));
});

// ─── No eligible candidates ──────────────────────────────────────────────────

test("search — impossible budget yields no-results (never a fake winner)", async () => {
  // Every AI tool in the corpus is $10+/mo, so an under-$5 budget clears none.
  const req = searchRequestSchema.parse({ query: "ai tool under $5" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(res.status, "no-results");
  if (res.status !== "no-results") return;
  assert.ok(res.ineligibleCount > 0);
  assert.ok(!("bestMatch" in res));
});

// ─── Mock-data production guard ───────────────────────────────────────────────

test("guard — seeded data is served + disclosed in development", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const res = await searchRecommendations(req, { now: NOW, env: { NODE_ENV: "development" } as NodeJS.ProcessEnv });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.seeded, true);
  assert.ok(res.warnings.some((w) => /seeded prototype data/i.test(w)));
});

test("guard — seeded data is BLOCKED in production by default", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const res = await searchRecommendations(req, { now: NOW, env: { NODE_ENV: "production" } as NodeJS.ProcessEnv });
  assert.equal(res.status, "error");
  if (res.status !== "error") return;
  assert.equal(res.code, "seeded_data_unavailable");
  assert.equal(httpStatusForResponse(res), 503);
});

test("guard — seeded data in production is served AND disclosed when explicitly allowed", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const env = { NODE_ENV: "production", ALLOW_SEEDED_DATA: "true" } as NodeJS.ProcessEnv;
  const res = await searchRecommendations(req, { now: NOW, env });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.seeded, true);
});

// ─── Diagnostics (Part 9) ─────────────────────────────────────────────────────

test("diagnostics — present in development, absent in production", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const dev = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.ok(dev.diagnostics, "dev should carry diagnostics");
  assert.equal(dev.diagnostics!.rankingInvoked, true);
  assert.deepEqual(dev.diagnostics!.candidateCategoryIds, ["developer-tools"]);

  const prod = await searchRecommendations(req, {
    now: NOW,
    env: { NODE_ENV: "production", ALLOW_SEEDED_DATA: "true" } as NodeJS.ProcessEnv,
  });
  assert.equal(prod.diagnostics, undefined, "prod must not expose diagnostics");
});

test("diagnostics — a gated query records rankingInvoked=false and no candidates", async () => {
  const req = searchRequestSchema.parse({ query: "quiet coffee shop with outlets near me" });
  const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.ok(res.diagnostics);
  assert.equal(res.diagnostics!.rankingInvoked, false);
  assert.equal(res.diagnostics!.candidateCount, 0);
  assert.deepEqual(res.diagnostics!.candidateCategoryIds, []);
});

// ─── Truthful seeded disclosure vs. real candidate source ────────────────────

function dbRow(over: Partial<PrismaEntityRow> = {}): PrismaEntityRow {
  return {
    id: "c1",
    key: "matomo",
    canonicalName: "Matomo",
    categoryId: "analytics-tools",
    officialDomain: "matomo.org",
    domainKey: "matomo.org",
    description: "Open-source analytics.",
    attributes: { hasFreePlan: true, platforms: "web" },
    status: "ACTIVE",
    source: "CANONICAL",
    lastUpdatedAt: NOW,
    aliases: [],
    externalIds: [],
    ...over,
  };
}

function fakeDelegate(rows: PrismaEntityRow[]): EntityDelegate {
  return {
    async findMany(args) {
      const w = (args as { where: { categoryId?: string; status?: { in: string[] }; source?: string } }).where;
      return rows.filter(
        (r) =>
          (!w.categoryId || r.categoryId === w.categoryId) &&
          (!w.status || w.status.in.includes(r.status)) &&
          (!w.source || r.source === w.source)
      );
    },
    async count(args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await (this as any).findMany(args)).length;
    },
    async findUnique(args) {
      const key = (args as { where: { key: string } }).where.key;
      return rows.find((r) => r.key === key) ?? null;
    },
  };
}

function fakeEvidenceDelegate(): EvidenceSnapshotDelegate {
  return { async findMany() { return []; } };
}

test("guard — a DB-backed result is never disclosed as seeded, even though seeded data is dev-allowed", async () => {
  const prevFlag = process.env.FEATURE_DB_ENTITIES;
  process.env.FEATURE_DB_ENTITIES = "on";
  try {
    const repo = new PrismaEntityRepository(fakeDelegate([dbRow()]), createEvidenceLoader(fakeEvidenceDelegate()));
    setDefaultEntityRepository(repo);

    const req = searchRequestSchema.parse({ query: "best analytics tool" });
    const res = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
    assert.equal(res.status, "success");
    if (res.status !== "success") return;
    assert.equal(res.seeded, false, "DB-backed candidates are real, not seeded fixtures");
    assert.equal(res.dataMode, "live");
    assert.ok(!res.warnings.some((w) => /seeded prototype data/i.test(w)));
  } finally {
    if (prevFlag === undefined) delete process.env.FEATURE_DB_ENTITIES;
    else process.env.FEATURE_DB_ENTITIES = prevFlag;
    setDefaultEntityRepository(null);
  }
});

// ─── Determinism ──────────────────────────────────────────────────────────────

test("search — deterministic: identical requests produce identical rankings", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const a = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  const b = await searchRecommendations(req, { now: NOW, env: DEV_ENV });
  assert.equal(a.status === "success" && b.status === "success", true);
  if (a.status !== "success" || b.status !== "success") return;
  const idsA = [a.bestMatch.entityId, ...a.alternatives.map((x) => x.entityId)];
  const idsB = [b.bestMatch.entityId, ...b.alternatives.map((x) => x.entityId)];
  assert.deepEqual(idsA, idsB);
});
