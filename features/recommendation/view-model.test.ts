import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveViewState,
  confidenceDisplay,
  summarizeEvidence,
  freshnessLabel,
  scoreRows,
  fitPercent,
  prioritiesFor,
  queryKeywords,
} from "./view-model";
import { searchRecommendations, searchRequestSchema } from "./api";
import type { SearchResponse } from "./api";
import type { EvidenceRef } from "./types";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV_ENV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

async function responseFor(query: string, categoryId?: string): Promise<SearchResponse> {
  const req = searchRequestSchema.parse({ query, ...(categoryId ? { categoryId } : {}) });
  return searchRecommendations(req, { now: NOW, env: DEV_ENV });
}

// ─── deriveViewState (all UI states) ─────────────────────────────────────────

test("view — idle before any search", () => {
  assert.equal(deriveViewState("idle", null), "idle");
});

test("view — loading while a request is in flight", () => {
  assert.equal(deriveViewState("loading", null), "loading");
});

test("view — error on a failed request or missing response", () => {
  assert.equal(deriveViewState("error", null), "error");
  assert.equal(deriveViewState("done", null), "error");
});

test("view — results for a successful search", async () => {
  const res = await responseFor("developer tools");
  assert.equal(res.status, "success");
  assert.equal(deriveViewState("done", res), "results");
});

test("view — no-results when candidates existed but none were eligible", async () => {
  const res = await responseFor("ai tool under $5");
  assert.equal(res.status, "no-results");
  assert.equal(deriveViewState("done", res), "no-results");
});

test("view — unsupported for a recognized-but-unsupported category", async () => {
  const res = await responseFor("quiet coffee shop with outlets near me");
  assert.equal(res.status, "unsupported-category");
  assert.equal(deriveViewState("done", res), "unsupported");
});

test("view — needs-category for an unknown/ambiguous query", async () => {
  const res = await responseFor("something good for my thing");
  assert.equal(res.status, "needs-clarification");
  assert.equal(deriveViewState("done", res), "needs-category");
});

test("view — error state for an error response", async () => {
  const req = searchRequestSchema.parse({ query: "developer tools" });
  const res = await searchRecommendations(req, { now: NOW, env: { NODE_ENV: "production" } as NodeJS.ProcessEnv });
  assert.equal(res.status, "error");
  assert.equal(deriveViewState("done", res), "error");
});

// ─── No software names leak into the coffee-shop state ───────────────────────

test("view — the coffee-shop response contains no software product names", async () => {
  const res = await responseFor("quiet coffee shop with outlets near me");
  const blob = JSON.stringify(res).toLowerCase();
  for (const name of ["driftdeploy", "glyph", "ironclad", "tally", "cortex", "helmport"]) {
    assert.ok(!blob.includes(name), `leaked: ${name}`);
  }
});

// ─── Confidence labelling ────────────────────────────────────────────────────

test("confidence — human labels, never fake precision", () => {
  assert.equal(confidenceDisplay("high").label, "High confidence");
  assert.equal(confidenceDisplay("medium").label, "Moderate confidence");
  assert.equal(confidenceDisplay("low").label, "Limited evidence");
});

// ─── Query interpretation helpers ─────────────────────────────────────────────

test("prioritiesFor — turns budget/audience/prefs into short chips", async () => {
  const res = await responseFor("best cheap analytics tool under $20 for a small team");
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  const chips = prioritiesFor(res.parsedQuery);
  assert.ok(chips.some((c) => /\$20/.test(c)));
  assert.ok(chips.length <= 6);
  assert.ok(chips.every((c) => !/^Prefers /i.test(c)));
});

test("queryKeywords — returns the user's salient words, stopwords removed", () => {
  const words = queryKeywords("quiet coffee shop with outlets near me");
  assert.ok(words.includes("coffee"));
  assert.ok(words.includes("outlets"));
  assert.ok(!words.includes("with"));
  assert.ok(!words.includes("near"));
});

// ─── Evidence summary ────────────────────────────────────────────────────────

test("summarizeEvidence — counts sources, reviews, and freshness", () => {
  const refs: EvidenceRef[] = [
    { sourceType: "official", sourceUrl: "u1", retrievedAt: new Date(NOW.getTime() - 5 * 86_400_000).toISOString(), rating: null, ratingScale: null, reviewCount: 0 },
    { sourceType: "github", sourceUrl: "u2", retrievedAt: new Date(NOW.getTime() - 20 * 86_400_000).toISOString(), rating: 4.6, ratingScale: 5, reviewCount: 1200 },
    { sourceType: "reddit", sourceUrl: "u3", retrievedAt: new Date(NOW.getTime() - 40 * 86_400_000).toISOString(), rating: 4.4, ratingScale: 5, reviewCount: 300 },
  ];
  const s = summarizeEvidence(refs, NOW);
  assert.equal(s.sourceCount, 3);
  assert.equal(s.totalReviews, 1500);
  assert.equal(Math.round(s.freshestAgeDays!), 5);
  assert.equal(Math.round(s.oldestAgeDays!), 40);
  assert.equal(s.missingRatings, false);
});

test("summarizeEvidence — flags missing ratings", () => {
  const refs: EvidenceRef[] = [
    { sourceType: "official", sourceUrl: "u1", retrievedAt: NOW.toISOString(), rating: null, ratingScale: null, reviewCount: 0 },
  ];
  assert.equal(summarizeEvidence(refs, NOW).missingRatings, true);
});

test("freshnessLabel — maps age to a human phrase", () => {
  assert.equal(freshnessLabel(3), "Updated recently");
  assert.equal(freshnessLabel(30), "Updated this quarter");
  assert.equal(freshnessLabel(90), "A few months old");
  assert.equal(freshnessLabel(300), "Possibly outdated");
  assert.equal(freshnessLabel(null), "No dated evidence");
});

// ─── Score rows ──────────────────────────────────────────────────────────────

test("scoreRows — returns one row per component, penalty last", async () => {
  const res = await responseFor("developer tools");
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  const rows = scoreRows(res.bestMatch);
  assert.equal(rows.length, 9);
  assert.equal(rows[rows.length - 1].isPenalty, true);
  const positives = rows.filter((r) => !r.isPenalty);
  for (let i = 1; i < positives.length; i++) {
    assert.ok(positives[i - 1].contribution >= positives[i].contribution);
  }
});

test("fitPercent — clamps to whole 0..100", () => {
  assert.equal(fitPercent(0.923), 92);
  assert.equal(fitPercent(1.5), 100);
  assert.equal(fitPercent(-0.2), 0);
});
