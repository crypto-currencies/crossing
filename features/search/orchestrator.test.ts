/**
 * End-to-end orchestrator tests.
 *
 * Hermetic: a fixture repository and fake sources, no database and no network.
 * These assert the behaviors the audit identified as broken
 * (docs/live-search-architecture.md §1.10) actually changed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import { FixtureEntityRepository } from "@/features/entities/repository";
import { StagedSearchOrchestrator } from "./orchestrator";
import { CatalogDiscoverySource } from "./sources/catalog";
import type { DiscoverySource, EvidenceSource } from "./sources/types";
import { MAX_RANKED_RESULTS, SPARSE_THRESHOLD, STAGE_NAMES } from "./contracts";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV_ENV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

function tool(i: number, over: Partial<Entity> = {}): Entity {
  return {
    id: `tool-${String(i).padStart(2, "0")}`,
    canonicalName: `Analytics Tool ${i}`,
    officialDomain: `https://tool${i}.example`,
    domainKey: `tool${i}.example`,
    categoryId: "analytics-tools",
    aliases: [],
    description: "Web analytics for small teams.",
    attributes: { hasFreePlan: true, platforms: "web", priceMonthly: 10 + i },
    externalIds: [],
    evidence: [],
    lastUpdatedAt: NOW.toISOString(),
    ...over,
  };
}

function corpus(n: number): Entity[] {
  return Array.from({ length: n }, (_, i) => tool(i + 1));
}

function build(entities: Entity[], extra: { evidenceSources?: EvidenceSource[]; discoverySources?: DiscoverySource[] } = {}) {
  const repo = new FixtureEntityRepository(entities);
  return new StagedSearchOrchestrator({
    repo,
    // `false` = use the demo corpus; production defaults to canonical-only.
    requireCanonical: false,
    discoverySources: extra.discoverySources ?? [new CatalogDiscoverySource(repo, false)],
    evidenceSources: extra.evidenceSources ?? [],
    availabilityProbe: async (categoryId) =>
      entities.filter((e) => e.categoryId === categoryId).length,
    now: () => NOW,
    env: DEV_ENV,
  });
}

function independentSource(rating: number): EvidenceSource {
  return {
    descriptor: { id: "reviews", label: "Reviews", independence: "independent", network: false },
    isAvailable: () => true,
    async gather(req) {
      const ev: Evidence = {
        sourceType: "editorial",
        sourceUrl: `https://reviews.example/${req.entityId}`,
        retrievedAt: NOW.toISOString(),
        rating,
        ratingScale: 5,
        reviewCount: 250,
        attributes: {},
        confidence: 0.8,
        entityMatchConfidence: 1,
      };
      return { evidence: [ev], issues: [], externalCalls: 1 };
    },
  };
}

// ─── The core product requirement ────────────────────────────────────────────

test("orchestrator — returns a ranked LIST of ~12, not one winner and two alternatives", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool for a small SaaS" });

  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;
  assert.equal(res.results.length, 12, "the default target is a full list");
  assert.ok(!("bestMatch" in res), "the one-winner field is gone");
  assert.ok(!("alternatives" in res), "the alternatives field is gone");
  assert.deepEqual(res.results.map((r) => r.rank), Array.from({ length: 12 }, (_, i) => i + 1));
});

test("orchestrator — an explicit resultCount widens the list up to the cap", async () => {
  const res = await build(corpus(30)).search({ query: "best analytics tool", resultCount: 20 });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;
  assert.equal(res.results.length, 20);
  assert.ok(res.results.length <= MAX_RANKED_RESULTS);
});

test("orchestrator — the example query from the brief yields a full ranked list", async () => {
  const res = await build(corpus(20)).search({
    query: "best privacy-friendly analytics for a small SaaS under $30",
  });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;
  assert.ok(res.results.length >= 10, `expected ≥10 results, got ${res.results.length}`);
  // The budget constraint was actually applied, not ignored.
  assert.ok(res.results.every((r) => r.matchedConstraints.some((c) => /\$30/.test(c))));
});

// ─── Honest states ───────────────────────────────────────────────────────────

test("orchestrator — a thin pool is reported as `sparse`, never dressed up as a survey", async () => {
  const res = await build(corpus(2)).search({ query: "best analytics tool" });

  assert.equal(res.status, "sparse");
  if (res.status !== "sparse") return;
  assert.equal(res.results.length, 2);
  assert.ok(/not a complete picture/i.test(res.message));
  assert.ok(res.results.length < SPARSE_THRESHOLD);
});

test("orchestrator — a recognized but empty category says so before ranking", async () => {
  // Catalog holds analytics tools; the query resolves to email-platforms.
  const res = await build(corpus(5)).search({ query: "best email platform" });

  assert.equal(res.status, "no-results");
  if (res.status !== "no-results") return;
  assert.equal(res.categoryId, "email-platforms");
  assert.ok(/no email platforms in its catalog/i.test(res.message));
  assert.ok(res.coverage.gaps.length > 0);
});

test("orchestrator — an unsupported local query never reaches ranking", async () => {
  const res = await build(corpus(20)).search({ query: "quiet coffee shop with outlets near me" });

  assert.equal(res.status, "unsupported-category");
  if (res.status !== "unsupported-category") return;
  assert.equal(res.category.domain, "local-business");
  const blob = JSON.stringify(res).toLowerCase();
  assert.ok(!blob.includes("analytics tool"), "no software may leak into a local answer");
});

test("orchestrator — an ambiguous query asks instead of guessing", async () => {
  const res = await build(corpus(20)).search({ query: "something good for my thing" });
  assert.equal(res.status, "needs-clarification");
  if (res.status !== "needs-clarification") return;
  assert.ok(res.suggestions.length > 0);
});

test("orchestrator — when every candidate fails a constraint, it says so and shows why", async () => {
  const pricey = corpus(6).map((e) => ({ ...e, attributes: { ...e.attributes, priceMonthly: 500 } }));
  const res = await build(pricey).search({ query: "analytics tool under $10" });

  assert.equal(res.status, "no-results");
  if (res.status !== "no-results") return;
  assert.equal(res.excluded.length, 6, "excluded candidates are shown, not hidden");
  assert.ok(res.excluded.every((e) => e.reasons.length > 0));
});

// ─── Evidence honesty (§1.9) ─────────────────────────────────────────────────

test("orchestrator — with no independent evidence, it warns rather than implying quality", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;

  assert.equal(res.coverage.withIndependentEvidence, 0);
  assert.equal(res.coverage.withRating, 0);
  assert.ok(res.warnings.some((w) => /vendor-published facts only/i.test(w)));
  assert.ok(res.results.every((r) => r.coverage.hasIndependent === false));
  assert.ok(
    res.results.every((r) => r.tradeoffs.some((t) => /No independent reviews/i.test(t))),
    "each result states its own evidence gap"
  );
});

test("orchestrator — independent evidence is counted in coverage", async () => {
  const res = await build(corpus(20), { evidenceSources: [independentSource(4.3)] }).search({
    query: "best analytics tool",
  });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;

  assert.equal(res.coverage.withIndependentEvidence, 20);
  assert.equal(res.coverage.withRating, 20);
  assert.ok(!res.warnings.some((w) => /vendor-published facts only/i.test(w)));
});

test("orchestrator — coverage gaps are stated, never smoothed over", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;
  assert.ok(res.coverage.gaps.some((g) => /no independent review evidence/i.test(g)));
  assert.ok(res.coverage.gaps.some((g) => /source-attributed rating/i.test(g)));
});

// ─── Determinism + observability ─────────────────────────────────────────────

test("orchestrator — identical requests produce identical rankings", async () => {
  const o = build(corpus(20));
  const a = await o.search({ query: "best analytics tool" });
  const b = await o.search({ query: "best analytics tool" });
  assert.equal(a.status, "ranked");
  assert.equal(b.status, "ranked");
  if (a.status !== "ranked" || b.status !== "ranked") return;
  assert.deepEqual(a.results.map((r) => r.entityId), b.results.map((r) => r.entityId));
});

test("orchestrator — the dev trace covers every stage that ran, in order", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.ok(res.trace, "development responses carry a trace");

  const ran = res.trace!.metrics.map((m) => m.stage);
  assert.deepEqual(ran, STAGE_NAMES.filter((s) => s !== "respond"));
  // Every stage reports its own timing and item counts.
  assert.ok(res.trace!.metrics.every((m) => typeof m.durationMs === "number"));
  assert.ok(res.trace!.metrics.every((m) => m.itemsOut >= 0));
});

test("orchestrator — the trace attributes candidates to their discovery source", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.deepEqual(res.trace!.candidateSources, { catalog: 20 });
});

test("orchestrator — production responses carry NO internal trace", async () => {
  const repo = new FixtureEntityRepository(corpus(20));
  const prod = new StagedSearchOrchestrator({
    repo,
    requireCanonical: false,
    discoverySources: [new CatalogDiscoverySource(repo, false)],
    evidenceSources: [],
    now: () => NOW,
    env: { NODE_ENV: "production" } as NodeJS.ProcessEnv,
  });
  const res = await prod.search({ query: "best analytics tool" });
  assert.equal(res.trace, undefined);
});

// ─── Fault isolation ─────────────────────────────────────────────────────────

test("orchestrator — a broken discovery source degrades the result, never 500s it", async () => {
  const repo = new FixtureEntityRepository(corpus(20));
  const broken: DiscoverySource = {
    descriptor: { id: "broken", label: "broken", independence: "independent", network: true },
    isAvailable: () => true,
    async discover() {
      throw new Error("upstream exploded");
    },
  };
  const o = new StagedSearchOrchestrator({
    repo,
    requireCanonical: false,
    discoverySources: [new CatalogDiscoverySource(repo, false), broken],
    evidenceSources: [],
    now: () => NOW,
    env: DEV_ENV,
  });

  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "ranked", "the healthy source still produced a result");
  assert.ok(res.trace!.issues.some((i) => i.subject === "broken"));
});

test("orchestrator — a broken evidence source degrades coverage, never the request", async () => {
  const broken: EvidenceSource = {
    descriptor: { id: "broken-ev", label: "broken", independence: "independent", network: true },
    isAvailable: () => true,
    async gather() {
      throw new Error("timeout");
    },
  };
  const res = await build(corpus(20), { evidenceSources: [broken] }).search({
    query: "best analytics tool",
  });
  assert.equal(res.status, "ranked");
  if (res.status !== "ranked") return;
  assert.equal(res.coverage.withIndependentEvidence, 0, "coverage honestly reports the gap");
});

test("orchestrator — with no discovery source at all, it returns no-results honestly", async () => {
  const repo = new FixtureEntityRepository(corpus(20));
  const o = new StagedSearchOrchestrator({
    repo,
    requireCanonical: false,
    discoverySources: [],
    evidenceSources: [],
    now: () => NOW,
    env: DEV_ENV,
  });
  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "no-results");
  assert.ok(res.trace!.issues.some((i) => /no discovery source/i.test(i.detail)));
});

// ─── Production safety ───────────────────────────────────────────────────────

test("orchestrator — canonical-only is the DEFAULT, so demo data cannot be ranked", async () => {
  const repo = new FixtureEntityRepository(corpus(20));
  const o = new StagedSearchOrchestrator({
    repo,
    // requireCanonical omitted → defaults to true → the fixture repo refuses.
    discoverySources: [new CatalogDiscoverySource(repo)],
    evidenceSources: [],
    now: () => NOW,
    env: DEV_ENV,
  });
  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "no-results", "a demo corpus must not be servable by default");
});
