import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDataMode } from "./data-mode";
import { feedbackRequestSchema } from "./feedback";

test("resolveDataMode — dev: seeded, allowed, disclosed", () => {
  const s = resolveDataMode({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  assert.deepEqual(s, { mode: "seeded", disclose: true, allowed: true });
});

test("resolveDataMode — prod default: seeded blocked and not disclosed", () => {
  const s = resolveDataMode({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.equal(s.allowed, false);
  assert.equal(s.disclose, false);
});

test("resolveDataMode — prod with explicit opt-in: allowed AND disclosed (never silent)", () => {
  const s = resolveDataMode({ NODE_ENV: "production", ALLOW_SEEDED_DATA: "true" } as NodeJS.ProcessEnv);
  assert.equal(s.allowed, true);
  assert.equal(s.disclose, true);
});

test("feedback schema — accepts a valid payload", () => {
  const r = feedbackRequestSchema.safeParse({ requestId: "abc", kind: "helpful" });
  assert.equal(r.success, true);
});

test("feedback schema — rejects an unknown kind", () => {
  const r = feedbackRequestSchema.safeParse({ requestId: "abc", kind: "love_it" });
  assert.equal(r.success, false);
});

test("feedback schema — caps note length", () => {
  const r = feedbackRequestSchema.safeParse({ requestId: "abc", kind: "not_helpful", note: "x".repeat(501) });
  assert.equal(r.success, false);
});
