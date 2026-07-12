import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRankingScore, RANKING_CONFIG } from "./ranking";

const NOW = new Date("2026-07-10T00:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function base(overrides: Partial<Parameters<typeof computeRankingScore>[0]> = {}) {
  return computeRankingScore({
    voteCount: 0,
    saveCount: 0,
    viewCount: 0,
    recentActivityCount: 0,
    editorialBoost: 0,
    publishedAt: daysAgo(30),
    now: NOW,
    ...overrides,
  });
}

test("computeRankingScore — more votes score higher, all else equal", () => {
  const low = base({ voteCount: 1 });
  const high = base({ voteCount: 10 });
  assert.ok(high > low);
});

test("computeRankingScore — more saves score higher, all else equal", () => {
  const low = base({ saveCount: 1 });
  const high = base({ saveCount: 10 });
  assert.ok(high > low);
});

test("computeRankingScore — votes are weighted more than saves", () => {
  const withVote = base({ voteCount: 1 });
  const withSave = base({ saveCount: 1 });
  assert.ok(withVote > withSave);
});

test("computeRankingScore — an old listing scores lower than an identical new one", () => {
  const old = base({ voteCount: 20, saveCount: 10, publishedAt: daysAgo(365) });
  const recent = base({ voteCount: 20, saveCount: 10, publishedAt: daysAgo(1) });
  assert.ok(recent > old);
});

test("computeRankingScore — time decay keeps applying as a listing ages further (no permanent plateau)", () => {
  const scoreAt30 = base({ voteCount: 50, saveCount: 20, publishedAt: daysAgo(30) });
  const scoreAt300 = base({ voteCount: 50, saveCount: 20, publishedAt: daysAgo(300) });
  assert.ok(scoreAt300 < scoreAt30);
});

test("computeRankingScore — raw view count cannot outscore a single vote", () => {
  const massiveViews = base({ viewCount: 1_000_000, voteCount: 0 });
  const oneVote = base({ viewCount: 0, voteCount: 1 });
  assert.ok(oneVote > massiveViews);
});

test("computeRankingScore — views have logarithmic, diminishing effect", () => {
  const delta1 = base({ viewCount: 100 }) - base({ viewCount: 0 });
  const delta2 = base({ viewCount: 100_000 }) - base({ viewCount: 99_900 });
  assert.ok(delta1 > delta2);
});

test("computeRankingScore — a brand-new listing with zero engagement still scores above zero", () => {
  const score = base({ publishedAt: daysAgo(0) });
  assert.ok(score > 0);
});

test("computeRankingScore — freshness bonus fades out after the freshness window", () => {
  const withinWindow = base({ publishedAt: daysAgo(1) });
  const pastWindow = base({ publishedAt: daysAgo(RANKING_CONFIG.FRESHNESS_WINDOW_DAYS + 1) });
  assert.ok(withinWindow > pastWindow);
  // A zero-engagement listing past the freshness window has nothing left to score it up.
  assert.equal(pastWindow, 0);
});

test("computeRankingScore — recent activity counts independently of lifetime totals", () => {
  const staleTotals = base({ voteCount: 100, saveCount: 100, recentActivityCount: 0 });
  const freshActivity = base({ voteCount: 100, saveCount: 100, recentActivityCount: 20 });
  assert.ok(freshActivity > staleTotals);
});

test("computeRankingScore — editorial boost is clamped to the configured max even if a caller passes more", () => {
  const atMax = base({ editorialBoost: RANKING_CONFIG.EDITORIAL_BOOST_MAX });
  const overMax = base({ editorialBoost: RANKING_CONFIG.EDITORIAL_BOOST_MAX * 10 });
  assert.equal(atMax, overMax);
});

test("computeRankingScore — editorial boost cannot go negative", () => {
  const zero = base({ editorialBoost: 0 });
  const negative = base({ editorialBoost: -50 });
  assert.equal(zero, negative);
});

test("computeRankingScore — is deterministic for identical inputs", () => {
  const a = base({ voteCount: 5, saveCount: 3, viewCount: 40 });
  const b = base({ voteCount: 5, saveCount: 3, viewCount: 40 });
  assert.equal(a, b);
});

test("computeRankingScore — avoids a pure popularity ranking (a heavily-viewed old listing loses to a lightly-voted new one)", () => {
  const popularOld = base({ viewCount: 500_000, voteCount: 2, publishedAt: daysAgo(400) });
  const modestNew = base({ viewCount: 50, voteCount: 5, publishedAt: daysAgo(2) });
  assert.ok(modestNew > popularOld);
});
