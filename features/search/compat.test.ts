/**
 * Legacy-projection tests.
 *
 * These protect the swap: /api/recommend now runs the live orchestrator, and
 * the existing search UI must keep rendering correctly against the projected
 * shape — including the honesty properties, which must survive the projection
 * rather than being flattened away.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Entity } from "@/features/recommendation/entities/types";
import { FixtureEntityRepository } from "@/features/entities/repository";
import { LiveSearchOrchestrator } from "./live-orchestrator";
import { CanonicalDiscoveryAdapter } from "./discovery/adapters";
import { toLegacyResponse } from "./compat";
import { BANNED_PUBLIC_TERMS } from "./copy";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

function ent(i: number, over: Partial<Entity> = {}): Entity {
  return {
    id: `tool-${String(i).padStart(2, "0")}`,
    canonicalName: `Analytics ${i}`,
    officialDomain: `https://analytics${i}.example`,
    domainKey: `analytics${i}.example`,
    categoryId: "analytics-tools",
    aliases: [],
    description: "Web analytics for small teams.",
    attributes: { hasFreePlan: true, platforms: "web", priceMonthly: 10 },
    externalIds: [],
    evidence: [],
    lastUpdatedAt: NOW.toISOString(),
    ...over,
  };
}

const corpus = (n: number) => Array.from({ length: n }, (_, i) => ent(i + 1));

function build(entities: Entity[], env: NodeJS.ProcessEnv = DEV) {
  const repo = new FixtureEntityRepository(entities);
  return new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [],
    availabilityProbe: async (c) => entities.filter((e) => e.categoryId === c).length,
    now: () => NOW,
    env,
  });
}

// ─── Shape the existing UI depends on ────────────────────────────────────────

test("projection — a ranked success renders as the legacy bestMatch + alternatives", async () => {
  const ranked = await build(corpus(12)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);

  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;
  assert.ok(legacy.bestMatch, "the UI reads response.bestMatch");
  assert.ok(Array.isArray(legacy.alternatives));
  assert.equal(legacy.alternatives.length, 9, "10 ranked results → 1 best + 9 alternatives");
});

test("projection — bestMatch is literally results[0], not a re-pick", async () => {
  const ranked = await build(corpus(12)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(ranked.status, "success");
  if (ranked.status !== "success" || legacy.status !== "success") return;

  assert.equal(legacy.bestMatch.entityId, ranked.results[0].entityId);
  assert.deepEqual(
    legacy.alternatives.map((a) => a.entityId),
    ranked.results.slice(1).map((r) => r.entityId),
    "order is preserved exactly — the projection never re-ranks"
  );
});

test("projection — every field ResultCard renders is present", async () => {
  const ranked = await build(corpus(5)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;

  for (const item of [legacy.bestMatch, ...legacy.alternatives]) {
    for (const key of [
      "entityId", "name", "domain", "categoryId", "score", "breakdown",
      "matchedConstraints", "unmetPreferences", "tradeoffs", "evidenceRefs", "freshnessWarnings",
    ]) {
      assert.ok(key in item, `ResultCard reads item.${key}`);
    }
    // The card renders `https://${item.domain}`, so it must be a bare host.
    assert.ok(!item.domain.startsWith("http"), `domain must be bare, got "${item.domain}"`);
  }
});

test("projection — ScoreDetails can read a breakdown for every item", async () => {
  const ranked = await build(corpus(4)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;

  for (const item of [legacy.bestMatch, ...legacy.alternatives]) {
    assert.ok(item.breakdown.components, "scoreRows() reads breakdown.components");
    assert.ok(item.breakdown.weights, "scoreRows() reads breakdown.weights");
  }
});

// ─── Honesty properties must survive the projection ──────────────────────────

test("projection — never claims seeded data, because the live pipeline has none", async () => {
  const ranked = await build(corpus(5)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;
  assert.equal(legacy.seeded, false);
  assert.equal(legacy.dataMode, "live");
  assert.ok(!legacy.warnings.some((w) => /seeded prototype data/i.test(w)));
});

test("projection — coverage gaps survive as warnings rather than being dropped", async () => {
  const ranked = await build(corpus(5)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;
  assert.ok(
    legacy.warnings.some((w) => /independent review/i.test(w)),
    "the old contract must still learn that reviews were missing"
  );
});

test("projection — an official-only result carries no rating in evidenceRefs", async () => {
  const ranked = await build(corpus(3)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;

  for (const ref of legacy.bestMatch.evidenceRefs) {
    assert.equal(ref.rating, null, "no vendor rating may appear through the projection");
    assert.equal(ref.reviewCount, 0);
  }
});

test("projection — confidence reflects evidence, not a winner margin", async () => {
  const ranked = await build(corpus(12)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;
  // No independent evidence anywhere → the label must not claim high confidence.
  assert.equal(legacy.confidenceLevel, "low");
});

test("projection — claims are grounded facts, never generated prose", async () => {
  const ranked = await build(corpus(3)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;
  for (const c of legacy.bestMatchClaims) {
    assert.ok(["rating", "attribute", "constraint", "tradeoff", "freshness"].includes(c.kind));
    assert.ok(c.text.length > 0);
  }
});

// ─── Gate states ─────────────────────────────────────────────────────────────

test("projection — an unsupported query maps to unsupported-category", async () => {
  const ranked = await build(corpus(12)).search({ query: "quiet coffee shop near me" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "unsupported-category");
  if (legacy.status !== "unsupported-category") return;
  assert.ok(legacy.message.length > 0);
  assert.ok(legacy.category, "UnsupportedState reads response.category");

  const blob = JSON.stringify(legacy).toLowerCase();
  assert.ok(!blob.includes("analytics 1"), "no software may leak into a local answer");
});

test("projection — an ambiguous query maps to needs-clarification with suggestions", async () => {
  const ranked = await build(corpus(12)).search({ query: "something good for my thing" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "needs-clarification");
  if (legacy.status !== "needs-clarification") return;
  assert.ok(legacy.suggestions.length > 0, "the picker reads response.suggestions");
  assert.ok(legacy.suggestions.every((s) => s.id && s.label));
});

test("projection — no-results carries a message and an ineligible count", async () => {
  const pricey = corpus(4).map((e) => ({ ...e, attributes: { ...e.attributes, priceMonthly: 900 } }));
  const ranked = await build(pricey).search({ query: "analytics tool under $10" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "no-results");
  if (legacy.status !== "no-results") return;
  assert.equal(legacy.ineligibleCount, 4);
  assert.ok(legacy.message.length > 0);
});

test("projection — a production outage maps to an error the old client renders", async () => {
  const repo = new FixtureEntityRepository(corpus(5));
  const prod = new LiveSearchOrchestrator({
    repo,
    discoveryAdapters: [],
    evidenceSources: [],
    now: () => NOW,
    env: { NODE_ENV: "production" } as NodeJS.ProcessEnv,
  });
  const legacy = toLegacyResponse(await prod.search({ query: "best analytics tool" }));
  assert.equal(legacy.status, "error");
  if (legacy.status !== "error") return;
  assert.ok(["seeded_data_unavailable", "internal_error"].includes(legacy.code));
  const blob = JSON.stringify(legacy).toLowerCase();
  assert.ok(!blob.includes("analytics 1"), "an outage must not leak fixtures");
});

// ─── Wording ─────────────────────────────────────────────────────────────────

test("projection — the legacy response carries no engineering terminology", async () => {
  const ranked = await build(corpus(12)).search({ query: "best analytics tool" });
  const legacy = toLegacyResponse(ranked);
  assert.equal(legacy.status, "success");
  if (legacy.status !== "success") return;

  // parsedQuery + breakdowns are structured data the UI reads, not prose.
  const prose = JSON.stringify({
    warnings: legacy.warnings,
    claims: legacy.bestMatchClaims,
    tradeoffs: [legacy.bestMatch, ...legacy.alternatives].map((i) => i.tradeoffs),
  }).toLowerCase();

  for (const term of BANNED_PUBLIC_TERMS) {
    assert.ok(!prose.includes(term), `leaked engineering term: "${term}"`);
  }
});
