/**
 * Per-stage tests.
 *
 * The point of the staged design is that each stage is testable ALONE, with no
 * database, no network, and no orchestrator. Every test here constructs one
 * stage, feeds it a typed input, and asserts on its typed output — which is the
 * property docs/live-search-architecture.md §2.1 principle 1 exists to buy.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import { FixtureEntityRepository } from "@/features/entities/repository";
import type { CandidateLead, SearchContext } from "./contracts";
import { TARGET_RESULT_COUNT } from "./contracts";
import { ParseStage, ResolveStage } from "./stages/interpret";
import { DiscoverStage, NormalizeStage, ResolveEntitiesStage } from "./stages/discovery";
import { GatherEvidenceStage } from "./stages/evidence";
import { FilterStage, RankStage } from "./stages/ranking";
import { enforceIndependence } from "./sources/types";
import type { DiscoveryOutcome, DiscoverySource, EvidenceSource } from "./sources/types";

const NOW = new Date("2026-07-20T00:00:00Z");

const ctx: SearchContext = {
  requestId: "test",
  now: NOW,
  env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
  deadlineMs: 5_000,
  isDev: true,
};

// ─── Builders ────────────────────────────────────────────────────────────────

function entity(over: Partial<Entity> = {}): Entity {
  return {
    id: "matomo",
    canonicalName: "Matomo",
    officialDomain: "https://matomo.org",
    domainKey: "matomo.org",
    categoryId: "analytics-tools",
    aliases: ["piwik"],
    description: "Open-source web analytics.",
    attributes: { hasFreePlan: true, platforms: "web", priceMonthly: 0 },
    externalIds: [],
    evidence: [],
    lastUpdatedAt: NOW.toISOString(),
    ...over,
  };
}

function evidence(over: Partial<Evidence> = {}): Evidence {
  return {
    sourceType: "official",
    sourceUrl: "https://matomo.org/",
    retrievedAt: NOW.toISOString(),
    rating: null,
    ratingScale: null,
    reviewCount: 0,
    attributes: { hasFreePlan: true },
    confidence: 0.6,
    entityMatchConfidence: 1,
    ...over,
  };
}

function lead(over: Partial<CandidateLead> = {}): CandidateLead {
  return {
    rawName: "Matomo",
    url: "https://matomo.org",
    sourceId: "test-source",
    sourceUrl: "https://matomo.org",
    leadConfidence: 1,
    ...over,
  };
}

function fakeDiscoverySource(id: string, leads: CandidateLead[], throws = false): DiscoverySource {
  return {
    descriptor: { id, label: id, independence: "independent", network: false },
    isAvailable: () => true,
    async discover(): Promise<DiscoveryOutcome> {
      if (throws) throw new Error("boom");
      return { leads, issues: [], externalCalls: 1 };
    },
  };
}

function fakeEvidenceSource(
  id: string,
  independence: "vendor" | "independent" | "community",
  ev: Evidence[]
): EvidenceSource {
  return {
    descriptor: { id, label: id, independence, network: false },
    isAvailable: () => true,
    async gather() {
      return { evidence: ev, issues: [], externalCalls: 1 };
    },
  };
}

// ─── Stage 1: parse ──────────────────────────────────────────────────────────

test("parse — targets a full ranked list, not the legacy 3", async () => {
  const res = await new ParseStage().run({ query: "best cheap analytics tool" }, ctx);
  assert.equal(res.output.targetCount, TARGET_RESULT_COUNT);
  assert.ok(res.output.targetCount >= 10, "the product target is a 10–20 item list");
});

test("parse — an explicit categoryId overrides the parser's guess", async () => {
  const res = await new ParseStage().run(
    { query: "something vague", categoryId: "hosting-platforms" },
    ctx
  );
  assert.equal(res.output.parsed.categoryId, "hosting-platforms");
});

test("parse — records ambiguities as issues instead of guessing", async () => {
  const res = await new ParseStage().run({ query: "something good for my thing" }, ctx);
  assert.ok(res.issues.length > 0, "an unparseable query must report issues");
  assert.ok(res.issues.every((i) => i.stage === "parse"));
});

test("parse — never throws on a hostile query", async () => {
  const res = await new ParseStage().run({ query: "%%%" }, ctx);
  assert.ok(res.output.parsed.rawQuery.length > 0);
});

// ─── Stage 2: resolve ────────────────────────────────────────────────────────

test("resolve — a supported query resolves to a category", async () => {
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);
  const res = await new ResolveStage().run(parse.output, ctx);
  assert.equal(res.output.resolution.status, "supported");
  assert.equal(res.output.categoryId, "analytics-tools");
});

test("resolve — a local query stays unsupported and yields no category", async () => {
  const parse = await new ParseStage().run({ query: "quiet coffee shop near me" }, ctx);
  const res = await new ResolveStage().run(parse.output, ctx);
  assert.equal(res.output.resolution.status, "unsupported");
  assert.equal(res.output.categoryId, null);
});

test("resolve — an empty category is reported as non-viable (the §1.5 fix)", async () => {
  const parse = await new ParseStage().run({ query: "best email platform" }, ctx);
  const res = await new ResolveStage(async () => 0).run(parse.output, ctx);
  assert.equal(res.output.resolution.status, "supported", "the vocabulary still resolves");
  assert.equal(res.output.availability?.viable, false, "but availability says it is empty");
  assert.ok(res.issues.some((i) => /no entities/i.test(i.detail)));
});

test("resolve — a populated category is viable", async () => {
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);
  const res = await new ResolveStage(async () => 14).run(parse.output, ctx);
  assert.deepEqual(res.output.availability, { knownCandidates: 14, viable: true });
});

// ─── Stage 3: discover ───────────────────────────────────────────────────────

test("discover — unions leads across sources and reports per-source counts", async () => {
  const stage = new DiscoverStage([
    fakeDiscoverySource("a", [lead({ rawName: "Matomo" })]),
    fakeDiscoverySource("b", [lead({ rawName: "Fathom", url: "https://usefathom.com" })]),
  ]);
  const res = await stage.run({ categoryId: "analytics-tools", rawQuery: "analytics", targetCount: 12 }, ctx);
  assert.equal(res.output.leads.length, 2);
  assert.deepEqual(res.output.bySource, { a: 1, b: 1 });
  assert.equal(res.metrics.externalCalls, 2);
});

test("discover — one broken source degrades breadth but never fails the search", async () => {
  const stage = new DiscoverStage([
    fakeDiscoverySource("good", [lead()]),
    fakeDiscoverySource("bad", [], true),
  ]);
  const res = await stage.run({ categoryId: "analytics-tools", rawQuery: "analytics", targetCount: 12 }, ctx);
  assert.equal(res.output.leads.length, 1, "the healthy source still contributed");
  assert.ok(res.issues.some((i) => i.subject === "bad" && i.code === "source_unavailable"));
});

test("discover — with no sources registered, says so rather than pretending", async () => {
  const res = await new DiscoverStage([]).run(
    { categoryId: "analytics-tools", rawQuery: "analytics", targetCount: 12 },
    ctx
  );
  assert.equal(res.output.leads.length, 0);
  assert.ok(res.issues.some((i) => /no discovery source/i.test(i.detail)));
});

test("discover — over-fetches wider than the target list size", async () => {
  let requestedLimit = 0;
  const probe: DiscoverySource = {
    descriptor: { id: "probe", label: "probe", independence: "independent", network: false },
    isAvailable: () => true,
    async discover(req) {
      requestedLimit = req.limit;
      return { leads: [], issues: [], externalCalls: 0 };
    },
  };
  await new DiscoverStage([probe]).run(
    { categoryId: "analytics-tools", rawQuery: "x", targetCount: 12 },
    ctx
  );
  assert.ok(requestedLimit > 12, "dedup + filtering shrink the pool, so discovery must over-fetch");
});

// ─── Stage 4: normalize ──────────────────────────────────────────────────────

test("normalize — derives a domain key and a comparable name", async () => {
  const res = await new NormalizeStage().run([lead({ rawName: "Matomo®" })], ctx);
  assert.equal(res.output[0].normalizedName, "matomo");
  assert.equal(res.output[0].domainKey, "matomo.org");
});

test("normalize — keeps a lead with an unparseable URL, flagging it", async () => {
  const res = await new NormalizeStage().run([lead({ url: "not a url" })], ctx);
  assert.equal(res.output.length, 1);
  assert.equal(res.output[0].domainKey, null);
  assert.ok(res.issues.some((i) => i.code === "partial_data"));
});

test("normalize — drops a nameless lead", async () => {
  const res = await new NormalizeStage().run([lead({ rawName: "  " })], ctx);
  assert.equal(res.output.length, 0);
  assert.ok(res.issues.some((i) => i.code === "validation_failed"));
});

// ─── Stage 5: resolveEntities ────────────────────────────────────────────────

test("resolveEntities — two sources naming the same product collapse to one entity", async () => {
  const repo = new FixtureEntityRepository([entity()]);
  const normalized = await new NormalizeStage().run(
    [lead({ sourceId: "a" }), lead({ sourceId: "b" })],
    ctx
  );
  const res = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  assert.equal(res.output.length, 1, "one product, not two");
  assert.equal(res.output[0].distinctSources, 2, "but two sources corroborate it");
});

test("resolveEntities — matches by alias when the URL is missing", async () => {
  const repo = new FixtureEntityRepository([entity()]);
  const normalized = await new NormalizeStage().run([lead({ rawName: "Piwik", url: undefined })], ctx);
  const res = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  assert.equal(res.output.length, 1);
  assert.equal(res.output[0].entity.id, "matomo");
});

test("resolveEntities — a lead with no catalog entity is dropped, not invented", async () => {
  const repo = new FixtureEntityRepository([entity()]);
  const normalized = await new NormalizeStage().run(
    [lead({ rawName: "Ghost Analytics", url: "https://ghost-analytics.example" })],
    ctx
  );
  const res = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  assert.equal(res.output.length, 0, "we never rank something we know nothing about");
  assert.ok(res.issues.some((i) => /no catalog entity/i.test(i.detail)));
});

test("resolveEntities — never crosses a category boundary", async () => {
  const repo = new FixtureEntityRepository([entity({ categoryId: "hosting-platforms" })]);
  const normalized = await new NormalizeStage().run([lead()], ctx);
  const res = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  assert.equal(res.output.length, 0);
});

test("resolveEntities — output order is deterministic", async () => {
  const repo = new FixtureEntityRepository([
    entity({ id: "matomo", domainKey: "matomo.org" }),
    entity({ id: "fathom", canonicalName: "Fathom", domainKey: "usefathom.com", officialDomain: "https://usefathom.com", aliases: [] }),
  ]);
  const leads = [lead({ rawName: "Fathom", url: "https://usefathom.com" }), lead()];
  const normalized = await new NormalizeStage().run(leads, ctx);
  const a = await new ResolveEntitiesStage(repo, false).run({ candidates: normalized.output, categoryId: "analytics-tools" }, ctx);
  const b = await new ResolveEntitiesStage(repo, false).run({ candidates: [...normalized.output].reverse(), categoryId: "analytics-tools" }, ctx);
  assert.deepEqual(
    a.output.map((c) => c.entity.id),
    b.output.map((c) => c.entity.id),
    "lead order must not change entity order"
  );
});

// ─── Stage 6: gatherEvidence — the §1.9 enforcement ──────────────────────────

test("enforceIndependence — a vendor source cannot assert a rating", () => {
  const { evidence: clean, stripped } = enforceIndependence(
    [evidence({ rating: 4.9, ratingScale: 5, reviewCount: 900 })],
    "vendor"
  );
  assert.equal(stripped, 1);
  assert.equal(clean[0].rating, null);
  assert.equal(clean[0].reviewCount, 0);
});

test("enforceIndependence — an independent source keeps its rating", () => {
  const { evidence: clean, stripped } = enforceIndependence(
    [evidence({ rating: 4.2, ratingScale: 5, reviewCount: 120 })],
    "independent"
  );
  assert.equal(stripped, 0);
  assert.equal(clean[0].rating, 4.2);
});

test("gatherEvidence — a vendor rating is stripped by the STAGE, not just the helper", async () => {
  const repo = new FixtureEntityRepository([entity()]);
  const normalized = await new NormalizeStage().run([lead()], ctx);
  const resolved = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  const stage = new GatherEvidenceStage([
    fakeEvidenceSource("vendor-src", "vendor", [evidence({ rating: 5, ratingScale: 5, reviewCount: 9999 })]),
  ]);
  const res = await stage.run({ candidates: resolved.output, categoryId: "analytics-tools" }, ctx);

  assert.equal(res.output[0].coverage.hasRating, false, "no vendor rating may survive");
  assert.equal(res.output[0].coverage.hasIndependent, false);
  assert.ok(res.issues.some((i) => /Stripped 1 quality claim/.test(i.detail)));
});

test("gatherEvidence — an independent rating survives and marks coverage", async () => {
  const repo = new FixtureEntityRepository([entity()]);
  const normalized = await new NormalizeStage().run([lead()], ctx);
  const resolved = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  const stage = new GatherEvidenceStage([
    fakeEvidenceSource("reviews", "independent", [
      evidence({ sourceType: "editorial", rating: 4.1, ratingScale: 5, reviewCount: 88 }),
    ]),
  ]);
  const res = await stage.run({ candidates: resolved.output, categoryId: "analytics-tools" }, ctx);

  assert.equal(res.output[0].coverage.hasRating, true);
  assert.equal(res.output[0].coverage.hasIndependent, true);
});

test("gatherEvidence — reports missing attributes rather than defaulting them", async () => {
  const repo = new FixtureEntityRepository([entity({ attributes: {} })]);
  const normalized = await new NormalizeStage().run([lead()], ctx);
  const resolved = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  const res = await new GatherEvidenceStage([]).run(
    { candidates: resolved.output, categoryId: "analytics-tools" },
    ctx
  );
  assert.ok(res.output[0].coverage.missingAttributes.includes("priceMonthly"));
  assert.equal(res.output[0].coverage.hasRating, false);
});

// ─── Stages 7–8: filter + rank ───────────────────────────────────────────────

async function evidencedFor(entities: Entity[]) {
  const repo = new FixtureEntityRepository(entities);
  const leads = entities.map((e) => lead({ rawName: e.canonicalName, url: e.officialDomain }));
  const normalized = await new NormalizeStage().run(leads, ctx);
  const resolved = await new ResolveEntitiesStage(repo, false).run(
    { candidates: normalized.output, categoryId: "analytics-tools" },
    ctx
  );
  return new GatherEvidenceStage([]).run({ candidates: resolved.output, categoryId: "analytics-tools" }, ctx);
}

test("filter — an over-budget candidate is excluded WITH a reason, not hidden", async () => {
  const ev = await evidencedFor([entity({ attributes: { priceMonthly: 99 } })]);
  const parse = await new ParseStage().run({ query: "analytics under $30" }, ctx);
  const res = await new FilterStage().run(
    { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
    ctx
  );
  assert.equal(res.output.eligible.length, 0);
  assert.equal(res.output.ineligible.length, 1);
  assert.ok(res.output.ineligible[0].ineligibleReasons.length > 0);
});

test("filter — an unverifiable constraint is flagged as a data gap, not a verdict", async () => {
  const ev = await evidencedFor([entity({ attributes: {} })]);
  const parse = await new ParseStage().run({ query: "analytics under $30" }, ctx);
  const res = await new FilterStage().run(
    { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
    ctx
  );
  assert.ok(
    res.issues.some((i) => i.code === "field_absent" && /unknown, not because it failed/.test(i.detail))
  );
});

test("rank — returns a ranked LIST with 1-based ranks and no winner flag", async () => {
  const entities = Array.from({ length: 8 }, (_, i) =>
    entity({
      id: `tool-${i}`,
      canonicalName: `Tool ${i}`,
      officialDomain: `https://tool${i}.example`,
      domainKey: `tool${i}.example`,
      aliases: [],
    })
  );
  const ev = await evidencedFor(entities);
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);
  const filtered = await new FilterStage().run(
    { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
    ctx
  );
  const res = await new RankStage().run({ ...filtered.output, targetCount: 12 }, ctx);

  assert.equal(res.output.results.length, 8);
  assert.deepEqual(
    res.output.results.map((r) => r.rank),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  assert.ok(!("best" in res.output), "there is no winner field — position is the ranking");
});

test("rank — honors the target count as a list size, not a hardcoded 3", async () => {
  const entities = Array.from({ length: 15 }, (_, i) =>
    entity({
      id: `tool-${i}`,
      canonicalName: `Tool ${i}`,
      officialDomain: `https://tool${i}.example`,
      domainKey: `tool${i}.example`,
      aliases: [],
    })
  );
  const ev = await evidencedFor(entities);
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);
  const filtered = await new FilterStage().run(
    { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
    ctx
  );
  const res = await new RankStage().run({ ...filtered.output, targetCount: 12 }, ctx);
  assert.equal(res.output.results.length, 12, "a full list, not best + 2 alternatives");
});

test("rank — is deterministic across runs", async () => {
  const entities = Array.from({ length: 6 }, (_, i) =>
    entity({
      id: `tool-${i}`,
      canonicalName: `Tool ${i}`,
      officialDomain: `https://tool${i}.example`,
      domainKey: `tool${i}.example`,
      aliases: [],
    })
  );
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);

  const run = async () => {
    const ev = await evidencedFor(entities);
    const f = await new FilterStage().run(
      { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
      ctx
    );
    const r = await new RankStage().run({ ...f.output, targetCount: 12 }, ctx);
    return r.output.results.map((x) => x.entityId);
  };

  assert.deepEqual(await run(), await run());
});

test("rank — a candidate with no independent evidence carries that as a stated tradeoff", async () => {
  const ev = await evidencedFor([entity({ evidence: [evidence()] })]);
  const parse = await new ParseStage().run({ query: "best analytics tool" }, ctx);
  const filtered = await new FilterStage().run(
    { candidates: ev.output, query: parse.output.parsed, categoryId: "analytics-tools" },
    ctx
  );
  const res = await new RankStage().run({ ...filtered.output, targetCount: 12 }, ctx);
  assert.ok(
    res.output.results[0].tradeoffs.some((t) => /No independent reviews/i.test(t)),
    "the absence must be stated on the result, not silently ignored"
  );
});
