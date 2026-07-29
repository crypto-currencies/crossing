import { test } from "node:test";
import assert from "node:assert/strict";
import { runRecommendation } from "./recommend";
import { scoreCandidate } from "./ranking/score";
import { discoverCandidates } from "./candidates/discover";
import { buildFixtures } from "./fixtures";
import { getCategory } from "./categories/definitions";
import { RecommendationInvariantError } from "./invariant";
import type { Entity } from "./entities/types";
import type { ParsedQuery } from "./query/schema";

const NOW = new Date("2026-07-20T00:00:00Z");

function entity(id: string): Entity {
  const e = buildFixtures(NOW).find((x) => x.id === id);
  if (!e) throw new Error(`fixture ${id} not found`);
  return e;
}

function baseQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    rawQuery: "test",
    categoryId: "analytics-tools",
    intent: "recommendation",
    hardConstraints: [],
    softPreferences: [],
    negativePreferences: [],
    requestedResultCount: 3,
    confidence: 0.6,
    ambiguities: [],
    ...overrides,
  };
}

// ─── Category gate (the corrective-pass invariant) ───────────────────────────

test("gate — an unsupported local query is NOT ranked against software", async () => {
  const result = await runRecommendation("quiet coffee shop with outlets near me", { now: NOW });
  assert.equal(result.resolution.status, "unsupported");
  assert.equal(result.resolution.domain, "local-business");
  assert.equal(result.best, null);
  assert.equal(result.alternatives.length, 0);
  // The old bug leaked software (DriftDeploy etc.) into ineligible/alternatives.
  assert.equal(result.ineligible.length, 0);
  assert.equal(result.categoryId, null);
});

test("gate — an unknown query returns a needs-category state, not a fallback ranking", async () => {
  const result = await runRecommendation("blue whimsical thing please", { now: NOW });
  assert.equal(result.resolution.status, "unknown");
  assert.equal(result.best, null);
  assert.equal(result.alternatives.length, 0);
  assert.equal(result.ineligible.length, 0);
});

test("gate — a weak keyword ('ide') is ambiguous and not auto-ranked", async () => {
  const result = await runRecommendation("need an ide", { now: NOW });
  assert.equal(result.resolution.status, "ambiguous");
  assert.equal(result.best, null);
  assert.ok(result.resolution.suggestedCategoryIds.includes("developer-tools"));
});

test("gate — an explicit category override lets an otherwise-unsupported query proceed", async () => {
  const result = await runRecommendation("something", {
    now: NOW,
    overrides: { categoryId: "hosting-platforms" },
  });
  assert.equal(result.resolution.status, "supported");
  assert.equal(result.categoryId, "hosting-platforms");
  assert.ok(result.best);
  assert.equal(result.best!.categoryId, "hosting-platforms");
});

test("gate — every ranked candidate belongs to the resolved category (no leakage)", async () => {
  const result = await runRecommendation("analytics tool", { now: NOW });
  assert.equal(result.categoryId, "analytics-tools");
  const ranked = [result.best, ...result.alternatives].filter(Boolean);
  for (const item of ranked) {
    assert.equal(item!.categoryId, "analytics-tools");
  }
});

test("discoverCandidates — refuses an empty category id (no all-corpus fallback)", () => {
  const corpus = buildFixtures(NOW);
  assert.throws(() => discoverCandidates("", corpus), RecommendationInvariantError);
});

// ─── Category isolation ───────────────────────────────────────────────────────

test("isolation — an analytics candidate set contains zero hosting entities", () => {
  const corpus = buildFixtures(NOW);
  const analytics = discoverCandidates("analytics-tools", corpus);
  assert.ok(analytics.length > 0);
  assert.ok(analytics.every((e) => e.categoryId === "analytics-tools"));
  assert.ok(!analytics.some((e) => e.categoryId === "hosting-platforms"));
});

test("isolation — a local-business search never surfaces developer tools", async () => {
  const result = await runRecommendation("quiet coffee shop with outlets near me", { now: NOW });
  const names = [result.best, ...result.alternatives, ...result.ineligible].filter(Boolean);
  assert.equal(names.length, 0);
  // And no dev-tool entity id appears anywhere in the serialized result.
  const blob = JSON.stringify(result);
  for (const id of ["glyph-code", "vellum-editor", "forge-ide"]) {
    assert.ok(!blob.includes(id), `dev tool leaked: ${id}`);
  }
});

test("isolation — a null-category query cannot retrieve the whole corpus", async () => {
  const corpus = buildFixtures(NOW);
  const result = await runRecommendation("blue whimsical thing please", { now: NOW, corpus });
  // Gated before retrieval: nothing scored, nothing eligible/ineligible.
  assert.equal(result.best, null);
  assert.equal(result.alternatives.length, 0);
  assert.equal(result.ineligible.length, 0);
  assert.equal(result.diagnostics?.candidateCount, 0);
});

// ─── Hard constraints ────────────────────────────────────────────────────────

test("hard constraint — over-budget candidate is marked ineligible, not ranked", async () => {
  const result = await runRecommendation("hosting platform under $30", { now: NOW });
  assert.ok(result.ineligible.some((i) => i.entityId === "ironclad-host"));
  assert.ok(!result.alternatives.some((a) => a.entityId === "ironclad-host"));
  assert.notEqual(result.best?.entityId, "ironclad-host");
});

test("hard constraint — open-source requirement excludes closed-source candidates", async () => {
  const result = await runRecommendation("open source analytics tool", { now: NOW });
  assert.ok(result.ineligible.some((i) => i.entityId === "northwind-analytics"));
  assert.equal(result.best?.entityId, "tally-metrics");
});

test("hard constraint — missing pricing under a budget is ineligible with an 'unverifiable' reason", async () => {
  const result = await runRecommendation("productivity tool under $10", { now: NOW });
  const quill = result.ineligible.find((i) => i.entityId === "quill-notes");
  assert.ok(quill, "quill-notes should be ineligible");
  assert.ok(quill!.reasons.some((r) => /unverifiable/i.test(r)));
});

test("hard constraint — scoreCandidate zeroes an ineligible candidate", () => {
  const cat = getCategory("hosting-platforms")!;
  const q = baseQuery({ categoryId: "hosting-platforms", budget: { max: 30 } });
  const b = scoreCandidate(entity("ironclad-host"), q, cat, NOW);
  assert.equal(b.eligible, false);
  assert.equal(b.total, 0);
});

// ─── Soft / negative preferences ─────────────────────────────────────────────

test("soft preference — a satisfied preference raises constraintFit", () => {
  const cat = getCategory("analytics-tools")!;
  const withPref = scoreCandidate(
    entity("tally-metrics"),
    baseQuery({ softPreferences: [{ attribute: "hasFreePlan", value: "true", weight: 1, label: "Free plan" }] }),
    cat,
    NOW
  );
  const withoutPref = scoreCandidate(entity("tally-metrics"), baseQuery(), cat, NOW);
  assert.ok(withPref.components.constraintFit > withoutPref.components.constraintFit);
});

test("negative preference — a matched dislike lowers constraintFit", () => {
  const cat = getCategory("analytics-tools")!;
  // Tally is open source; expressing "avoid open source" should penalize it.
  const q = baseQuery({ negativePreferences: [{ attribute: "openSource", value: "true", weight: 1, label: "Avoid open source" }] });
  const penalized = scoreCandidate(entity("tally-metrics"), q, cat, NOW);
  const neutral = scoreCandidate(entity("tally-metrics"), baseQuery(), cat, NOW);
  assert.ok(penalized.components.constraintFit < neutral.components.constraintFit);
});

// ─── Bayesian effect end-to-end ──────────────────────────────────────────────

test("ranking — a proven high-volume tool beats a near-perfect-but-thin one", async () => {
  const result = await runRecommendation("developer tools", { now: NOW });
  assert.equal(result.best?.entityId, "glyph-code");
  const glyph = result.best!.score;
  const vellum = [result.best!, ...result.alternatives].find((i) => i.entityId === "vellum-editor")?.score ?? 0;
  assert.ok(glyph > vellum, `glyph ${glyph} !> vellum ${vellum}`);
});

// ─── Stale evidence penalty ──────────────────────────────────────────────────

test("freshness — stale evidence scores low and warns", () => {
  const cat = getCategory("ai-tools")!;
  const nimbus = scoreCandidate(entity("nimbus-ai"), baseQuery({ categoryId: "ai-tools" }), cat, NOW);
  assert.ok(nimbus.components.freshness < 0.2, `freshness ${nimbus.components.freshness}`);
  assert.ok(nimbus.warnings.some((w) => /older|fresh/i.test(w)));
});

test("freshness — a fresh AI tool outranks a stale one", async () => {
  const result = await runRecommendation("ai tool", { now: NOW });
  assert.equal(result.best?.entityId, "cortex-write");
});

// ─── Source diversity ────────────────────────────────────────────────────────

test("source diversity — more distinct sources score higher", () => {
  const cat = getCategory("hosting-platforms")!;
  const drift = scoreCandidate(entity("driftdeploy"), baseQuery({ categoryId: "hosting-platforms" }), cat, NOW);
  const helmport = scoreCandidate(entity("helmport"), baseQuery({ categoryId: "hosting-platforms" }), cat, NOW);
  // DriftDeploy has 4 distinct sources; Helmport has 2.
  assert.ok(drift.components.sourceDiversity > helmport.components.sourceDiversity);
  assert.equal(drift.components.sourceDiversity, 1);
});

// ─── Missing evidence ────────────────────────────────────────────────────────

test("missing evidence — no ratings falls back to the category prior with zero review confidence", () => {
  const cat = getCategory("analytics-tools")!;
  const bare: Entity = {
    id: "bare",
    canonicalName: "Bare Tool",
    officialDomain: "bare.example",
    domainKey: "bare.example",
    categoryId: "analytics-tools",
    aliases: [],
    description: "No evidence at all.",
    attributes: { hasFreePlan: true },
    externalIds: [],
    evidence: [],
    lastUpdatedAt: NOW.toISOString(),
  };
  const b = scoreCandidate(bare, baseQuery(), cat, NOW);
  assert.equal(b.components.reviewConfidence, 0);
  assert.ok(Math.abs(b.components.generalQuality - cat.categoryAverageRating) < 1e-9);
});

// ─── Conflicting sources ─────────────────────────────────────────────────────

test("risk — conflicting sources produce a warning", () => {
  const cat = getCategory("email-platforms")!;
  const parcel = scoreCandidate(entity("parcel-mail"), baseQuery({ categoryId: "email-platforms" }), cat, NOW);
  assert.ok(parcel.warnings.some((w) => /disagree/i.test(w)));
});

// ─── Ranking weights ─────────────────────────────────────────────────────────

test("ranking weights — a component difference moves the total in the expected direction", () => {
  const cat = getCategory("developer-tools")!;
  const glyph = scoreCandidate(entity("glyph-code"), baseQuery({ categoryId: "developer-tools" }), cat, NOW);
  const vellum = scoreCandidate(entity("vellum-editor"), baseQuery({ categoryId: "developer-tools" }), cat, NOW);
  // Glyph leads on quality, review confidence, and diversity → higher total.
  assert.ok(glyph.components.reviewConfidence > vellum.components.reviewConfidence);
  assert.ok(glyph.total > vellum.total);
});

// ─── Deterministic ordering ──────────────────────────────────────────────────

test("ordering — identical inputs produce identical ordering across runs", async () => {
  const a = await runRecommendation("developer tools", { now: NOW });
  const b = await runRecommendation("developer tools", { now: NOW });
  const idsA = [a.best?.entityId, ...a.alternatives.map((x) => x.entityId)];
  const idsB = [b.best?.entityId, ...b.alternatives.map((x) => x.entityId)];
  assert.deepEqual(idsA, idsB);
});

// ─── Output shape ────────────────────────────────────────────────────────────

test("output — returns a best plus at least two alternatives when available", async () => {
  const result = await runRecommendation("developer tools", { now: NOW });
  assert.ok(result.best);
  assert.ok(result.alternatives.length >= 2);
});

test("output — best item carries a full score breakdown and evidence refs", async () => {
  const result = await runRecommendation("developer tools", { now: NOW });
  const best = result.best!;
  assert.ok(best.breakdown);
  assert.ok(best.evidenceRefs.length > 0);
  assert.equal(typeof best.score, "number");
});

// ─── Explanation input (grounding) ───────────────────────────────────────────

test("explanation — input carries only evidence-derived claims + a grounding instruction", async () => {
  const result = await runRecommendation("developer tools", { now: NOW });
  const exp = result.explanationInput;
  assert.ok(exp.best);
  assert.ok(exp.best!.claims.length > 0);
  assert.match(exp.instruction, /Do not introduce/i);

  // Every rating claim must reference a review count that actually exists in
  // the entity's evidence — nothing invented.
  const glyph = entity("glyph-code");
  const realCounts = new Set(glyph.evidence.map((e) => e.reviewCount.toLocaleString()));
  for (const claim of exp.best!.claims) {
    if (claim.kind !== "rating") continue;
    const hasRealCount = [...realCounts].some((c) => claim.text.includes(c));
    assert.ok(hasRealCount, `rating claim references an unknown review count: "${claim.text}"`);
  }
});

test("confidence — resolves to a level consistent with the numeric score", async () => {
  const result = await runRecommendation("developer tools", { now: NOW });
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  const expected = result.confidence >= 0.66 ? "high" : result.confidence >= 0.4 ? "medium" : "low";
  assert.equal(result.confidenceLevel, expected);
});
