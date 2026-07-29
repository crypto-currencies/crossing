import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEvidence } from "./extract";
import { normalizePricing } from "./pricing";
import {
  PLAUSIBLE_HOME,
  FATHOM_PRICING,
  MATOMO_PRICING,
  PER_USER_PRICING,
  ANNUAL_ONLY,
} from "./__fixtures__/pilot-pages";

// ─── Plausible: JSON-LD, free trial, monthly offer, no free plan ─────────────

test("pilot — Plausible: JSON-LD name/platforms/canonical + free trial + monthly", () => {
  const ev = extractEvidence(PLAUSIBLE_HOME, { url: "https://plausible.io/" });
  assert.equal(ev.name?.value, "Plausible Analytics");
  assert.equal(ev.name?.method, "json-ld");
  assert.equal(ev.canonicalUrl?.value, "https://plausible.io/");
  assert.ok(ev.platforms?.value.includes("web"));
  assert.ok(ev.platforms?.value.includes("api"));
  assert.equal(ev.hasFreeTrial?.value, true);
  assert.equal(ev.hasFreePlan, null); // no free plan asserted → unknown, not false
  assert.ok(ev.docsLinks?.value.some((u) => /\/docs/.test(u)));

  const p = normalizePricing(ev);
  assert.equal(p.kind, "fixed_monthly");
  assert.equal(p.minMonthly, 9);
  assert.equal(p.currency, "USD");
});

// ─── Fathom: flat monthly + annual display, free trial, explicit NO free plan ─

test("pilot — Fathom: flat monthly, no free plan, free trial", () => {
  const ev = extractEvidence(FATHOM_PRICING, { url: "https://usefathom.com/pricing" });
  assert.equal(ev.name?.value, "Fathom Analytics");
  assert.equal(ev.hasFreePlan?.value, false); // "no free plan" → explicit false
  assert.equal(ev.hasFreeTrial?.value, true);

  const p = normalizePricing(ev);
  assert.equal(p.kind, "fixed_monthly");
  assert.equal(p.minMonthly, 15);
});

// ─── Matomo: free self-host tier + paid cloud + contact-sales enterprise ─────

test("pilot — Matomo: 'Free' tier detected, cheapest monthly wins, contact-sales present", () => {
  const ev = extractEvidence(MATOMO_PRICING, { url: "https://matomo.org/pricing/" });
  assert.equal(ev.hasFreePlan?.value, true); // On-Premise "Free" price cell
  assert.equal(ev.hasFreeTrial?.value, true); // 21-day free trial

  const p = normalizePricing(ev);
  // Free plan + a monthly paid tier → freemium; cheapest monthly is $19.
  assert.equal(p.kind, "freemium");
  assert.equal(p.minMonthly, 19);
});

// ─── Generic pricing edge cases ──────────────────────────────────────────────

test("pilot — per-user pricing → per_user_monthly", () => {
  const ev = extractEvidence(PER_USER_PRICING, { url: "https://x.com/pricing" });
  const p = normalizePricing(ev);
  assert.equal(p.kind, "per_user_monthly");
  assert.equal(p.minMonthly, 9);
});

test("pilot — annual-only display is NOT treated as a monthly price", () => {
  const ev = extractEvidence(ANNUAL_ONLY, { url: "https://x.com/pricing" });
  const p = normalizePricing(ev);
  assert.equal(p.minMonthly, null); // no monthly price asserted
  assert.notEqual(p.kind, "fixed_monthly");
  assert.equal(p.kind, "annual");
});

test("pilot — provenance is retained for every extracted fact", () => {
  const ev = extractEvidence(PLAUSIBLE_HOME, { url: "https://plausible.io/" });
  for (const fact of [ev.name, ev.platforms, ev.hasFreeTrial]) {
    assert.ok(fact);
    assert.ok(fact!.method);
    assert.ok(fact!.confidence > 0);
    assert.equal(typeof fact!.sourceText, "string");
  }
});
