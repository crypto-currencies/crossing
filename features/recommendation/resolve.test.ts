import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCategory,
  CATEGORY_CONFIDENCE_THRESHOLD,
} from "./categories/resolve";

// ─── Supported ───────────────────────────────────────────────────────────────

test("resolve — a confident software query is supported and gets a category", () => {
  const r = resolveCategory("best cheap analytics tool for a small SaaS");
  assert.equal(r.status, "supported");
  assert.equal(r.domain, "software");
  assert.equal(r.categoryId, "analytics-tools");
  assert.ok(r.confidence >= CATEGORY_CONFIDENCE_THRESHOLD);
});

test("resolve — an explicit supported category always wins", () => {
  // Query text alone is unsupported, but the user selected a category.
  const r = resolveCategory("quiet coffee shop near me", "hosting-platforms");
  assert.equal(r.status, "supported");
  assert.equal(r.categoryId, "hosting-platforms");
  assert.equal(r.confidence, 1);
});

test("resolve — an explicit UNKNOWN category is not honored (no guessing)", () => {
  const r = resolveCategory("hosting platform", "not-a-real-category");
  assert.equal(r.status, "unknown");
  assert.equal(r.categoryId, null);
});

// ─── Recognized but unsupported ──────────────────────────────────────────────

test("resolve — a local coffee-shop query is unsupported (local-business), never ranked", () => {
  const r = resolveCategory("quiet coffee shop with outlets near me");
  assert.equal(r.status, "unsupported");
  assert.equal(r.domain, "local-business");
  assert.equal(r.categoryId, null);
  assert.equal(r.requiresLocation, true);
});

test("resolve — a physical product query is unsupported (product)", () => {
  const r = resolveCategory("recommend a good camera under $500");
  assert.equal(r.status, "unsupported");
  assert.equal(r.domain, "product");
  assert.equal(r.categoryId, null);
});

test("resolve — a local service query is unsupported and needs a location", () => {
  const r = resolveCategory("a reliable house cleaner");
  assert.equal(r.status, "unsupported");
  assert.equal(r.requiresLocation, true);
});

// ─── Ambiguous / unknown ─────────────────────────────────────────────────────

test("resolve — a weak/short keyword hit is ambiguous, with suggestions, not auto-ranked", () => {
  // "ide" is a real dev-tools alias but too short to clear the confidence bar.
  const r = resolveCategory("need an ide");
  assert.equal(r.status, "ambiguous");
  assert.equal(r.categoryId, null);
  assert.ok(r.suggestedCategoryIds.includes("developer-tools"));
});

test("resolve — a fully unrecognized query is unknown", () => {
  const r = resolveCategory("blue whimsical thing please");
  assert.equal(r.status, "unknown");
  assert.equal(r.categoryId, null);
  assert.equal(r.suggestedCategoryIds.length, 0);
});
