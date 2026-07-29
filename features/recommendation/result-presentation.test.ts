import assert from "node:assert/strict";
import test from "node:test";
import {
  bestFor,
  checkedDate,
  evidenceStrengthLabel,
  priceSummary,
  primaryTradeoff,
} from "@/components/search/result-presentation";
import type { RankedResult } from "@/features/search/response";

function result(overrides: Partial<RankedResult> = {}): RankedResult {
  return {
    rank: 1,
    entityId: "privacy-analytics",
    name: "Privacy Analytics",
    url: "https://privacy.example",
    category: "Analytics tools",
    shortReason: "Meets privacy and small-team requirements.",
    bestFor: "Small SaaS teams",
    keyAttributes: [],
    tradeoffs: [],
    sourceSummaries: [],
    evidenceStrength: "limited",
    freshness: { ageDays: null, label: "No dated information" },
    ...overrides,
  };
}

test("presentation adapter does not invent a price when the ranked response omits one", () => {
  assert.equal(priceSummary(result()), "Pricing not available");
  assert.equal(
    priceSummary(result({ priceSummary: { display: "Free plan available", monthlyFrom: 0, hasFreePlan: true, hasFreeTrial: null, verified: true } })),
    "Free plan available",
  );
});

test("presentation adapter uses explicit best-for and tradeoff fields", () => {
  assert.equal(bestFor(result()), "Small SaaS teams");
  assert.equal(bestFor(result({ bestFor: undefined })), "A balanced choice");
  assert.equal(primaryTradeoff(result({ tradeoffs: ["Setup takes longer"] })), "Setup takes longer");
  assert.equal(primaryTradeoff(result()), "No tradeoff was noted in the available sources");
});

test("evidence language describes sources rather than model confidence", () => {
  assert.equal(evidenceStrengthLabel(result({ evidenceStrength: "strong" })), "Backed by multiple independent sources");
  assert.equal(evidenceStrengthLabel(result({ evidenceStrength: "moderate" })), "Independent information is available");
  assert.equal(evidenceStrengthLabel(result({ evidenceStrength: "limited" })), "Few independent reviews available");
});

test("source dates are formatted without changing the underlying value", () => {
  assert.equal(checkedDate("2026-07-01T00:00:00.000Z"), "Jul 1, 2026");
  assert.equal(checkedDate("not-a-date"), "Check date unavailable");
});
