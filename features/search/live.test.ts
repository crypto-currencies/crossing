/**
 * Live search pipeline tests (Part 15).
 *
 * Hermetic: a fake search provider, a fixture repository, an injected clock.
 * No network, no database. Each test names the guarantee it protects.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import { FixtureEntityRepository } from "@/features/entities/repository";

import { LiveSearchOrchestrator } from "./live-orchestrator";
import { CanonicalDiscoveryAdapter, WebSearchDiscoveryAdapter } from "./discovery/adapters";
import { AgenticDiscoveryAdapter, DEFAULT_AGENTIC_LIMITS } from "./discovery/agentic";
import { runLayeredDiscovery } from "./discovery/runner";
import { candidate, type DiscoveryContext } from "./discovery/types";
import { resolveCandidates, diceCoefficient } from "./resolution/resolve";
import { classifyEvidence, reputationFrom, stripOfficialReputation } from "./evidence/classes";
import { scoreBroad, profileFor } from "./ranking/profiles";
import { SearchBudget, resolveProvider } from "./providers/registry";
import type { WebSearchOutcome, WebSearchProvider } from "./providers/types";
import { SearchCache, EnrichmentQueue, QueryPopularity, isSourceStale } from "./cache";
import { paginate, snapshotId, decodeCursor } from "./response";
import { BANNED_PUBLIC_TERMS } from "./copy";
import { isDemoMode, searchCapabilities } from "./live-default";

const NOW = new Date("2026-07-20T00:00:00Z");
const DEV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

// ─── Builders ────────────────────────────────────────────────────────────────

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

function corpus(n: number): Entity[] {
  return Array.from({ length: n }, (_, i) => ent(i + 1));
}

function officialEv(over: Partial<Evidence> = {}): Evidence {
  return {
    sourceType: "official",
    sourceUrl: "https://analytics1.example/",
    retrievedAt: NOW.toISOString(),
    rating: null,
    ratingScale: null,
    reviewCount: 0,
    attributes: { hasFreePlan: true, priceMonthly: 10, platforms: "web" },
    confidence: 0.6,
    entityMatchConfidence: 1,
    ...over,
  };
}

function independentEv(over: Partial<Evidence> = {}): Evidence {
  return {
    ...officialEv(),
    sourceType: "trustpilot",
    sourceUrl: "https://reviews.example/x",
    rating: 4.2,
    ratingScale: 5,
    reviewCount: 320,
    reviewTopics: [{ topic: "reliability", sentiment: 0.7, mentions: 90 }],
    ...over,
  };
}

function fakeProvider(
  results: { title: string; url: string; snippet: string }[],
  behavior: { fail?: boolean; retryable?: boolean } = {}
): WebSearchProvider {
  return {
    id: "brave",
    label: "fake",
    costPerRequestUsd: 0.001,
    isConfigured: () => true,
    async search(): Promise<WebSearchOutcome> {
      if (behavior.fail) {
        return {
          ok: false,
          error: {
            kind: behavior.retryable ? "rate_limited" : "unauthorized",
            retryable: Boolean(behavior.retryable),
            detail: "fake failure",
          },
          requestCount: 1,
          durationMs: 5,
        };
      }
      return {
        ok: true,
        results: results.map((r, i) => ({ ...r, position: i + 1 })),
        requestCount: 1,
        durationMs: 5,
      };
    },
  };
}

function ctxFor(over: Partial<DiscoveryContext> = {}): DiscoveryContext {
  return {
    requestId: "t",
    now: NOW,
    env: DEV,
    deadlineMs: 5000,
    isDev: true,
    categoryId: "analytics-tools",
    categoryName: "Analytics tools",
    rawQuery: "best analytics tool",
    wanted: 50,
    ...over,
  };
}

function build(entities: Entity[], over: Partial<ConstructorParameters<typeof LiveSearchOrchestrator>[0]> = {}) {
  const repo = new FixtureEntityRepository(entities);
  return new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [],
    availabilityProbe: async (c) => entities.filter((e) => e.categoryId === c).length,
    now: () => NOW,
    env: DEV,
    ...over,
  });
}

// ─── Part 13: no fixtures in production ──────────────────────────────────────

test("production — with no discovery adapter, returns unavailable, never fixtures", async () => {
  const repo = new FixtureEntityRepository(corpus(20));
  const o = new LiveSearchOrchestrator({
    repo,
    discoveryAdapters: [],
    evidenceSources: [],
    env: PROD,
    now: () => NOW,
  });
  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.status, "error");
  if (res.status !== "error") return;
  assert.equal(res.code, "search_unavailable");
  const blob = JSON.stringify(res).toLowerCase();
  assert.ok(!blob.includes("analytics 1"), "no fixture entity may leak");
});

test("production — demo mode is refused outside development", () => {
  assert.equal(isDemoMode({ NODE_ENV: "production", SEARCH_DEMO_MODE: "on" } as NodeJS.ProcessEnv), false);
  assert.equal(isDemoMode({ NODE_ENV: "development", SEARCH_DEMO_MODE: "on" } as NodeJS.ProcessEnv), true);
});

test("production — no seeded rating survives into a response", async () => {
  // A fixture-style entity carrying an invented rating on an OFFICIAL source.
  const seeded = ent(1, { evidence: [officialEv({ rating: 5, ratingScale: 5, reviewCount: 9999 })] });
  const res = await build([seeded]).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.results[0].reviewSummary, undefined, "official-class ratings never become a review summary");
  assert.equal(res.evidenceCoverage.withRatings, 0);
});

// ─── Part 3: broad candidate discovery ───────────────────────────────────────

test("discovery — layered runner stops once the pool is deep enough", async () => {
  const repo = new FixtureEntityRepository(corpus(30));
  let webCalled = false;
  const web = new WebSearchDiscoveryAdapter(
    fakeProvider([{ title: "X", url: "https://x.example", snippet: "" }]),
    new SearchBudget()
  );
  const spy = {
    ...web,
    id: "web-search" as const,
    layer: "web-search" as const,
    supports: () => true,
    discover: async (c: DiscoveryContext) => {
      webCalled = true;
      return web.discover(c);
    },
  };
  const result = await runLayeredDiscovery([new CanonicalDiscoveryAdapter(repo, false), spy], ctxFor());
  assert.ok(result.candidates.length >= 20);
  assert.equal(webCalled, false, "the paid layer must not run when canonical already suffices");
});

test("discovery — falls through to web search when canonical is thin", async () => {
  const repo = new FixtureEntityRepository(corpus(2));
  const provider = fakeProvider(
    Array.from({ length: 15 }, (_, i) => ({
      title: `Tool ${i}`,
      url: `https://tool${i}.example`,
      snippet: "analytics",
    }))
  );
  const result = await runLayeredDiscovery(
    [
      new CanonicalDiscoveryAdapter(repo, false),
      new WebSearchDiscoveryAdapter(provider, new SearchBudget()),
    ],
    ctxFor()
  );
  assert.ok(result.candidates.length > 2, "web search must add breadth");
  assert.ok(result.layersRun.includes("web-search"));
  assert.ok(result.queriesIssued.length > 0);
});

test("discovery — aggregator and junk hosts never become candidates", async () => {
  const provider = fakeProvider([
    { title: "Best analytics 2026", url: "https://www.reddit.com/r/analytics/x", snippet: "" },
    { title: "Roundup", url: "https://g2.com/categories/analytics", snippet: "" },
    { title: "Google", url: "https://google.com/search?q=x", snippet: "" },
    { title: "Real Tool", url: "https://realtool.example", snippet: "" },
  ]);
  const out = await new WebSearchDiscoveryAdapter(provider, new SearchBudget()).discover(ctxFor());
  const hosts = out.candidates.map((c) => c.candidateUrl);
  assert.deepEqual(hosts, ["https://realtool.example"]);
});

test("discovery — a discovered candidate is never marked canonical", async () => {
  const provider = fakeProvider([{ title: "New Tool", url: "https://newtool.example", snippet: "" }]);
  const out = await new WebSearchDiscoveryAdapter(provider, new SearchBudget()).discover(ctxFor());
  assert.ok(out.candidates[0].discoveryConfidence < 1, "web mentions are never certain");
  assert.equal(out.candidates[0].layer, "web-search");
});

// ─── Part 4: provider behavior ───────────────────────────────────────────────

test("provider — selection is env-driven, not hardcoded", () => {
  assert.equal(resolveProvider({ env: {} as NodeJS.ProcessEnv }), null);
  const brave = resolveProvider({ env: { NODE_ENV: "development", BRAVE_SEARCH_API_KEY: "k" } as NodeJS.ProcessEnv });
  assert.equal(brave?.id, "brave");
  const bing = resolveProvider({
    env: { NODE_ENV: "development", SEARCH_PROVIDER: "bing", BING_SEARCH_API_KEY: "k", BRAVE_SEARCH_API_KEY: "k2" } as NodeJS.ProcessEnv,
  });
  assert.equal(bing?.id, "bing", "an explicit choice must win over availability order");
});

test("provider — an explicitly requested but unconfigured provider is not silently swapped", () => {
  const p = resolveProvider({
    env: { NODE_ENV: "development", SEARCH_PROVIDER: "bing", BRAVE_SEARCH_API_KEY: "k" } as NodeJS.ProcessEnv,
  });
  assert.equal(p, null, "misconfiguration must be visible, not papered over");
});

test("provider — a non-retryable failure stops further queries", async () => {
  const provider = fakeProvider([], { fail: true, retryable: false });
  const out = await new WebSearchDiscoveryAdapter(provider, new SearchBudget()).discover(ctxFor());
  assert.equal(out.candidates.length, 0);
  assert.equal(out.queriesIssued.length, 1, "an auth failure must not burn the query budget");
  assert.ok(out.issues.some((i) => i.code === "source_rejected"));
});

test("provider — raw provider detail never reaches a public message", async () => {
  const repo = new FixtureEntityRepository(corpus(1));
  const res = await build(corpus(1), {
    repo,
    discoveryAdapters: [
      new CanonicalDiscoveryAdapter(repo, false),
      new WebSearchDiscoveryAdapter(fakeProvider([], { fail: true }), new SearchBudget()),
    ],
  }).search({ query: "best analytics tool" });

  const publicBlob = JSON.stringify({ ...res, diagnostics: undefined }).toLowerCase();
  assert.ok(!publicBlob.includes("fake failure"), "provider detail is operator-only");
});

test("provider — the budget caps total spend", () => {
  const budget = new SearchBudget({ maxQueries: 2, maxCostUsd: 1, maxDurationMs: 10_000 });
  assert.equal(budget.canSpend(), true);
  budget.record(2, 0.001, 10);
  assert.equal(budget.canSpend(), false);
  assert.equal(budget.snapshot().exhaustedBy, "queries");
});

// ─── Part 5: agentic bounds ──────────────────────────────────────────────────

test("agent — never exceeds its query limit, whatever the planner proposes", async () => {
  const provider = fakeProvider([{ title: "T", url: "https://t.example", snippet: "" }]);
  const greedyPlanner = {
    id: "greedy",
    // Returns far more queries than allowed — the LOOP must clamp it.
    async plan() {
      return Array.from({ length: 50 }, (_, i) => `query ${i}`);
    },
  };
  const agent = new AgenticDiscoveryAdapter(
    provider,
    new SearchBudget(),
    { ...DEFAULT_AGENTIC_LIMITS, maxQueries: 3, maxIterations: 5 },
    greedyPlanner
  );
  await agent.discover(ctxFor());
  const trace = agent.getTrace()!;
  assert.ok(trace.usage.queries <= 3, `issued ${trace.usage.queries} queries, limit was 3`);
});

test("agent — never exceeds its candidate-URL limit", async () => {
  const provider = fakeProvider(
    Array.from({ length: 40 }, (_, i) => ({ title: `T${i}`, url: `https://t${i}.example`, snippet: "" }))
  );
  const agent = new AgenticDiscoveryAdapter(provider, new SearchBudget(), {
    ...DEFAULT_AGENTIC_LIMITS,
    maxCandidateUrls: 5,
  });
  const out = await agent.discover(ctxFor());
  assert.ok(out.candidates.length <= 5);
  assert.ok(agent.getTrace()!.usage.candidateUrls <= 5);
});

test("agent — cannot invent a candidate the provider never returned", async () => {
  const inventingPlanner = {
    id: "inventing",
    async plan() {
      return ["ImaginaryProduct9000"];
    },
  };
  // Provider returns nothing for that query.
  const agent = new AgenticDiscoveryAdapter(fakeProvider([]), new SearchBudget(), DEFAULT_AGENTIC_LIMITS, inventingPlanner);
  const out = await agent.discover(ctxFor());
  assert.equal(out.candidates.length, 0, "a planner name with no search hit yields nothing");
});

test("agent — a throwing planner degrades gracefully", async () => {
  const badPlanner = {
    id: "bad",
    async plan(): Promise<string[]> {
      throw new Error("model exploded");
    },
  };
  const agent = new AgenticDiscoveryAdapter(fakeProvider([]), new SearchBudget(), DEFAULT_AGENTIC_LIMITS, badPlanner);
  const out = await agent.discover(ctxFor());
  assert.equal(out.candidates.length, 0);
  assert.ok(out.issues.some((i) => i.code === "fallback_used"));
});

test("agent — emits a structured trace with its limits and stop reason", async () => {
  const agent = new AgenticDiscoveryAdapter(fakeProvider([]), new SearchBudget());
  await agent.discover(ctxFor());
  const trace = agent.getTrace()!;
  assert.ok(trace.limits);
  assert.ok(trace.stoppedBy !== undefined);
  assert.equal(trace.planner, "deterministic");
});

// ─── Part 6: entity resolution ───────────────────────────────────────────────

test("resolution — matches on canonical domain", () => {
  const c = candidate({
    name: "Whatever The Title Said",
    candidateUrl: "https://analytics1.example",
    sourceUrl: "https://x.example",
    sourceAdapter: "web-search",
    layer: "web-search",
    discoveryConfidence: 0.6,
    discoveredAt: NOW.toISOString(),
  });
  const report = resolveCandidates([c], corpus(3), { categoryId: "analytics-tools" });
  assert.equal(report.counts.canonical, 1);
  assert.equal(report.outcomes[0].kind, "canonical");
});

test("resolution — similar names alone NEVER auto-merge", () => {
  const c = candidate({
    name: "Analytics 1 Pro",
    candidateUrl: "https://completely-different.example",
    sourceUrl: "https://x.example",
    sourceAdapter: "web-search",
    layer: "web-search",
    discoveryConfidence: 0.6,
    discoveredAt: NOW.toISOString(),
  });
  const report = resolveCandidates([c], corpus(3), { categoryId: "analytics-tools" });
  const outcome = report.outcomes[0];
  assert.notEqual(outcome.kind, "canonical", "a name resemblance must never become a merge");
  assert.ok(outcome.kind === "probable-duplicate" || outcome.kind === "new-unresolved");
});

test("resolution — a fuzzy match routes to review, not to canonical", () => {
  const c = candidate({
    name: "Analytics 1",
    candidateUrl: null,
    sourceUrl: "https://x.example",
    sourceAdapter: "agentic",
    layer: "agentic",
    discoveryConfidence: 0.35,
    discoveredAt: NOW.toISOString(),
  });
  // Exact name with no URL: cannot reach the name+domain rung.
  const report = resolveCandidates([c], corpus(3), { categoryId: "analytics-tools" });
  assert.equal(report.counts.canonical, 0);
});

test("resolution — an unknown product becomes new-unresolved, never ranked", () => {
  const c = candidate({
    name: "Totally New Tool",
    candidateUrl: "https://totallynew.example",
    sourceUrl: "https://x.example",
    sourceAdapter: "web-search",
    layer: "web-search",
    discoveryConfidence: 0.6,
    discoveredAt: NOW.toISOString(),
  });
  const report = resolveCandidates([c], corpus(3), { categoryId: "analytics-tools" });
  assert.equal(report.outcomes[0].kind, "new-unresolved");
  assert.equal(report.resolved.length, 0, "unresolved candidates are not rankable");
});

test("resolution — a cross-category match is rejected", () => {
  const other = ent(1, { categoryId: "hosting-platforms" });
  const c = candidate({
    name: "Analytics 1",
    candidateUrl: "https://analytics1.example",
    sourceUrl: "https://x.example",
    sourceAdapter: "web-search",
    layer: "web-search",
    discoveryConfidence: 0.6,
    discoveredAt: NOW.toISOString(),
  });
  const report = resolveCandidates([c], [other], { categoryId: "analytics-tools" });
  assert.equal(report.outcomes[0].kind, "rejected");
});

test("resolution — duplicates from different adapters collapse and count corroboration", () => {
  const mk = (adapter: string) =>
    candidate({
      name: "Analytics 1",
      candidateUrl: "https://analytics1.example",
      sourceUrl: `https://${adapter}.example`,
      sourceAdapter: adapter,
      layer: "web-search",
      discoveryConfidence: 0.6,
      discoveredAt: NOW.toISOString(),
    });
  const report = resolveCandidates([mk("a"), mk("b"), mk("c")], corpus(3), { categoryId: "analytics-tools" });
  assert.equal(report.resolved.length, 1);
  assert.equal(report.resolved[0].distinctAdapters, 3);
});

test("resolution — dice coefficient behaves", () => {
  assert.equal(diceCoefficient("matomo", "matomo"), 1);
  assert.ok(diceCoefficient("matomo", "matomoo") > 0.8);
  assert.ok(diceCoefficient("matomo", "vercel") < 0.3);
});

// ─── Part 9: evidence classes ────────────────────────────────────────────────

test("evidence — official claims never generate a reputation score", () => {
  const rep = reputationFrom([officialEv({ rating: 5, ratingScale: 5, reviewCount: 10_000 })], NOW);
  assert.equal(rep.aggregateRating, null, "an official rating must not aggregate");
  assert.equal(rep.reviewCount, 0);
  assert.equal(rep.sourceDiversity, 0);
});

test("evidence — independent sources DO generate a reputation score", () => {
  const rep = reputationFrom([independentEv()], NOW);
  assert.ok(rep.aggregateRating !== null);
  assert.equal(rep.reviewCount, 320);
  assert.equal(rep.sourceDiversity, 1);
});

test("evidence — an onsite rating is stripped even if a source smuggles it in", () => {
  const { evidence, stripped } = stripOfficialReputation([
    officialEv({ rating: 4.9, ratingScale: 5, reviewCount: 500 }),
  ]);
  assert.equal(stripped, 1);
  assert.equal(evidence[0].rating, null);
  assert.equal(evidence[0].reviewCount, 0);
});

test("evidence — the three classes stay separate", () => {
  const classified = classifyEvidence(
    [officialEv(), independentEv(), { ...independentEv(), sourceType: "reddit", rating: null, ratingScale: null }],
    NOW
  );
  assert.ok(classified.official.sourceUrls.length > 0);
  assert.ok(classified.reputation.sourceDiversity >= 1);
  assert.ok(classified.editorial.discussions.length >= 1);
});

test("evidence — missing reviews are reported, never defaulted", () => {
  const classified = classifyEvidence([officialEv()], NOW);
  assert.equal(classified.hasIndependent, false);
  assert.equal(classified.hasIndependentRating, false);
  assert.equal(classified.reputation.aggregateRating, null);
});

test("evidence — the same snapshot from two paths is counted once, not twice", async () => {
  // The repository attaches evidence AND an evidence source returns the same
  // record — the real production wiring. Double-counting would inflate review
  // counts and source diversity, both of which are ranking inputs.
  const shared = independentEv();
  const entity = ent(1, { evidence: [shared] });
  const echoSource = {
    descriptor: { id: "echo", label: "echo", independence: "independent" as const, network: false },
    isAvailable: () => true,
    async gather() {
      return { evidence: [{ ...shared }], issues: [], externalCalls: 0 };
    },
  };

  const res = await build([entity], { evidenceSources: [echoSource] }).search({
    query: "best analytics tool",
  });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;

  assert.equal(res.results[0].sourceSummaries.length, 1, "one observation, one source");
  assert.equal(
    res.results[0].reviewSummary?.reviewCount,
    320,
    "review count must not double"
  );
});

// ─── Part 10: ranking ────────────────────────────────────────────────────────

test("ranking — a candidate with independent reviews outranks an identical one without", () => {
  const category = { id: "analytics-tools", categoryAverageRating: 0.8, stalenessThresholdDays: 90 };
  const base = {
    query: { rawQuery: "analytics", softPreferences: [], negativePreferences: [], hardConstraints: [] },
    corroboratingAdapters: 1,
    now: NOW,
  };
  const reviewed = scoreBroad({
    ...base,
    entity: ent(1),
    evidence: classifyEvidence([officialEv(), independentEv()], NOW),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category: category as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: base.query as any,
  });
  const unreviewed = scoreBroad({
    ...base,
    entity: ent(2),
    evidence: classifyEvidence([officialEv()], NOW),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category: category as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: base.query as any,
  });
  assert.ok(reviewed.total > unreviewed.total, "evidence must be rewarded over its absence");
});

test("ranking — missing data is a penalty, not a flattering prior", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category = { id: "analytics-tools", categoryAverageRating: 0.8, stalenessThresholdDays: 90 } as any;
  const bare = scoreBroad({
    entity: ent(1, { attributes: {} }),
    evidence: classifyEvidence([], NOW),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { rawQuery: "analytics", softPreferences: [], negativePreferences: [], hardConstraints: [] } as any,
    category,
    corroboratingAdapters: 1,
    now: NOW,
  });
  assert.ok(bare.components.missingDataLevel > 0);
  assert.ok(bare.penalty > 0);
  assert.equal(bare.components.reviewQuality, 0, "no rating must score 0, not the category average");
});

test("ranking — category profiles differ", () => {
  assert.notDeepEqual(profileFor("hosting-platforms"), profileFor("ai-tools"));
  assert.ok(profileFor("ai-tools").freshness > profileFor("hosting-platforms").freshness);
});

// ─── Parts 7/8: contract + pagination ────────────────────────────────────────

test("contract — a successful search returns a ranked list with user-facing copy", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.results.length, 10, "default page size is 10");
  assert.ok(res.title.length > 0);
  assert.ok(res.summary);
  assert.ok(res.totalDiscovered >= res.results.length);
  assert.ok(res.results.every((r) => r.shortReason.length > 0));
  assert.ok(res.results.every((r) => ["strong", "moderate", "limited"].includes(r.evidenceStrength)));
});

test("contract — limit is honored up to the cap of 20", async () => {
  const res = await build(corpus(30)).search({ query: "best analytics tool", limit: 20 });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.results.length, 20);
});

test("pagination — pages do not repeat or skip entities", async () => {
  const o = build(corpus(25));
  const p1 = await o.search({ query: "best analytics tool", limit: 10 });
  assert.equal(p1.status, "success");
  if (p1.status !== "success") return;
  assert.ok(p1.nextCursor);

  const p2 = await o.search({ query: "best analytics tool", limit: 10, cursor: p1.nextCursor });
  assert.equal(p2.status, "success");
  if (p2.status !== "success") return;

  const ids1 = p1.results.map((r) => r.entityId);
  const ids2 = p2.results.map((r) => r.entityId);
  assert.equal(new Set([...ids1, ...ids2]).size, ids1.length + ids2.length, "no duplicates across pages");
  assert.deepEqual(
    p2.results.map((r) => r.rank),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    "ranks continue across the page boundary"
  );
});

test("pagination — a cursor from a different ordering is rejected, not misapplied", () => {
  const a = ["a", "b", "c"];
  const b = ["x", "y", "z"];
  const page = paginate(a, (i) => i, { limit: 2 });
  const stale = page.nextCursor!;
  const applied = paginate(b, (i) => i, { limit: 2, cursor: stale });
  assert.deepEqual(applied.items, ["x", "y"], "a stale cursor restarts rather than skipping");
  assert.notEqual(snapshotId(a), snapshotId(b));
  assert.ok(decodeCursor(stale));
});

test("pagination — results are not padded to hit ten", async () => {
  const res = await build(corpus(4)).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.equal(res.results.length, 4, "four real options beat ten padded ones");
  assert.ok(res.warnings.some((w) => /isn't a complete picture/i.test(w)));
});

// ─── Category isolation + constraints ────────────────────────────────────────

test("isolation — an unsupported query never falls back to software", async () => {
  const res = await build(corpus(20)).search({ query: "quiet coffee shop with outlets near me" });
  assert.equal(res.status, "unsupported");
  const blob = JSON.stringify(res).toLowerCase();
  assert.ok(!blob.includes("analytics 1"));
});

test("isolation — results never cross a category boundary", async () => {
  const mixed = [...corpus(5), ent(99, { categoryId: "hosting-platforms", canonicalName: "A Host" })];
  const res = await build(mixed).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  assert.ok(!res.results.some((r) => r.name === "A Host"));
});

test("constraints — an over-budget option is excluded with a reason", async () => {
  const pricey = corpus(5).map((e) => ({ ...e, attributes: { ...e.attributes, priceMonthly: 500 } }));
  const res = await build(pricey).search({ query: "analytics tool under $10" });
  assert.equal(res.status, "no-results");
  if (res.status !== "no-results") return;
  assert.equal(res.excluded.length, 5);
  assert.ok(res.excluded.every((e) => e.reasons.length > 0));
});

// ─── Part 11: public wording ─────────────────────────────────────────────────

test("wording — no engineering terminology appears in a public response", async () => {
  const res = await build(corpus(20)).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;

  // Strip the dev-only blocks; everything else is user-visible.
  const publicOnly = {
    ...res,
    diagnostics: undefined,
    query: undefined,
    results: res.results.map((r) => ({ ...r, scoreBreakdown: undefined })),
  };
  const blob = JSON.stringify(publicOnly).toLowerCase();

  for (const term of BANNED_PUBLIC_TERMS) {
    assert.ok(!blob.includes(term), `public response leaked engineering term: "${term}"`);
  }
});

test("wording — confidence describes the evidence, not the model", async () => {
  const res = await build(corpus(5)).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
  if (res.status !== "success") return;
  const blob = JSON.stringify(res.warnings).toLowerCase();
  assert.ok(!blob.includes("confidence"));
  assert.ok(blob.includes("independent review data"));
});

// ─── Part 12: caching ────────────────────────────────────────────────────────

test("cache — a second call hits rather than recomputing", async () => {
  const cache = new SearchCache<number>({ ttlMs: 1000, staleWhileRevalidateMs: 0, maxEntries: 10 });
  let loads = 0;
  const load = async () => { loads += 1; return 42; };

  const a = await cache.get("k", load);
  const b = await cache.get("k", load);
  assert.equal(a.hit, "miss");
  assert.equal(b.hit, "fresh");
  assert.equal(loads, 1);
});

test("cache — concurrent identical requests are deduplicated into one load", async () => {
  const cache = new SearchCache<number>({ ttlMs: 1000, staleWhileRevalidateMs: 0, maxEntries: 10 });
  let loads = 0;
  const load = async () => {
    loads += 1;
    await new Promise((r) => setTimeout(r, 10));
    return 7;
  };
  await Promise.all([cache.get("k", load), cache.get("k", load), cache.get("k", load)]);
  assert.equal(loads, 1, "three concurrent callers must trigger one provider call");
  assert.ok(cache.getStats().dedupedWaits >= 2);
});

test("cache — stale-while-revalidate serves immediately and refreshes behind", async () => {
  let clock = 0;
  const cache = new SearchCache<number>(
    { ttlMs: 100, staleWhileRevalidateMs: 1000, maxEntries: 10 },
    () => clock
  );
  let value = 1;
  const load = async () => value;

  await cache.get("k", load);
  clock = 150; // past fresh, inside the stale window
  value = 2;
  const stale = await cache.get("k", load);
  assert.equal(stale.hit, "stale");
  assert.equal(stale.value, 1, "the stale value is served without waiting");

  await new Promise((r) => setTimeout(r, 5));
  assert.equal(cache.peek("k")?.value, 2, "the background refresh landed");
});

test("cache — per-source staleness differs by source type", () => {
  const fresh = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString();
  assert.equal(isSourceStale("github", fresh, NOW), true, "github data goes stale in a day");
  assert.equal(isSourceStale("editorial", fresh, NOW), false, "editorial lasts a month");
});

test("enrichment — entities with no evidence are queued, not crawled inline", async () => {
  const o = build(corpus(3));
  await o.search({ query: "best analytics tool" });
  assert.ok(o.enrichmentQueue.size > 0, "missing evidence must schedule background work");
  const drained = o.enrichmentQueue.drain();
  assert.ok(drained.every((t) => t.reason === "missing" || t.reason === "stale"));
});

test("enrichment — the queue de-duplicates and bounds itself", () => {
  const q = new EnrichmentQueue(2);
  q.enqueue("a", "missing");
  q.enqueue("a", "missing");
  q.enqueue("b", "stale");
  q.enqueue("c", "stale");
  assert.equal(q.size, 2);
});

test("popularity — tracks frequency for precomputation", () => {
  const p = new QueryPopularity();
  p.record("analytics");
  p.record("analytics");
  p.record("hosting");
  assert.deepEqual(p.top(1), [{ query: "analytics", count: 2 }]);
});

// ─── Partial failure + timeout ───────────────────────────────────────────────

test("resilience — a failing discovery layer degrades coverage, not the request", async () => {
  const repo = new FixtureEntityRepository(corpus(12));
  const broken = {
    id: "broken",
    layer: "web-search" as const,
    supports: () => true,
    async discover(): Promise<never> {
      throw new Error("upstream down");
    },
  };
  const res = await build(corpus(12), {
    repo,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false), broken],
  }).search({ query: "best analytics tool" });
  assert.equal(res.status, "success");
});

test("resilience — an aborted request does not hang discovery", async () => {
  const controller = new AbortController();
  controller.abort();
  const repo = new FixtureEntityRepository(corpus(2));
  const result = await runLayeredDiscovery(
    [new CanonicalDiscoveryAdapter(repo, false), new WebSearchDiscoveryAdapter(fakeProvider([]), new SearchBudget())],
    ctxFor({ signal: controller.signal, wanted: 50 })
  );
  assert.ok(result.issues.some((i) => i.code === "source_timeout") || result.candidates.length <= 2);
});

// ─── Observability ───────────────────────────────────────────────────────────

test("diagnostics — development responses carry the full trace", async () => {
  const res = await build(corpus(12)).search({ query: "best analytics tool" });
  assert.ok(res.diagnostics, "dev must expose diagnostics");
  const d = res.diagnostics!;
  assert.equal(d.categoryId, "analytics-tools");
  assert.ok(d.rawCandidateCount > 0);
  assert.ok(d.stageMetrics.length > 0);
  assert.ok(typeof d.estimatedCostUsd === "number");
  assert.ok(typeof d.finalResultCount === "number");
});

test("diagnostics — adapter attribution survives a discovery cache hit", async () => {
  const o = build(corpus(12));
  const first = await o.search({ query: "best analytics tool" });
  const second = await o.search({ query: "best analytics tool" });

  assert.deepEqual(
    second.diagnostics!.discoveryAdapters,
    first.diagnostics!.discoveryAdapters,
    "a cached run must still report which adapters produced the candidates"
  );
  assert.ok(second.diagnostics!.discoveryAdapters.length > 0);
  assert.equal(second.diagnostics!.cacheHits.discovery, true);
  assert.equal(second.diagnostics!.estimatedCostUsd, 0, "a cache hit spends nothing");
});

test("diagnostics — production responses carry none", async () => {
  const repo = new FixtureEntityRepository(corpus(12));
  const o = new LiveSearchOrchestrator({
    repo,
    requireCanonical: false,
    requireLiveDiscovery: false,
    discoveryAdapters: [new CanonicalDiscoveryAdapter(repo, false)],
    evidenceSources: [],
    now: () => NOW,
    env: PROD,
  });
  const res = await o.search({ query: "best analytics tool" });
  assert.equal(res.diagnostics, undefined);
});

test("capabilities — reports what this deployment can actually do", () => {
  const none = searchCapabilities({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  assert.equal(none.provider, null);
  assert.deepEqual(none.layers, ["canonical"]);

  const withBrave = searchCapabilities({
    NODE_ENV: "development",
    BRAVE_SEARCH_API_KEY: "k",
  } as NodeJS.ProcessEnv);
  assert.equal(withBrave.provider, "brave");
  assert.ok(withBrave.layers.includes("web-search"));
});
