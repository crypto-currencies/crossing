import { test } from "node:test";
import assert from "node:assert/strict";
import { bayesianRating } from "./evidence/bayesian";

const CATEGORY_AVG = 0.8;

test("bayesianRating — many reviews pull the result close to the observed rating", () => {
  const r = bayesianRating({
    rating: 4.6,
    ratingScale: 5,
    reviewCount: 8000,
    categoryAverage: CATEGORY_AVG,
  });
  assert.equal(r.usedPrior, false);
  // Observed 0.92 with 8000 reviews → adjusted should sit right next to it.
  assert.ok(Math.abs(r.adjusted - 0.92) < 0.01, `adjusted=${r.adjusted}`);
  assert.ok(r.evidenceWeight > 0.99);
});

test("bayesianRating — few reviews get pulled toward the category prior", () => {
  const perfectButThin = bayesianRating({
    rating: 5,
    ratingScale: 5,
    reviewCount: 3,
    categoryAverage: CATEGORY_AVG,
  });
  // A perfect 5.0 from 3 reviews must land well below a real 5.0.
  assert.ok(perfectButThin.adjusted < 0.86, `adjusted=${perfectButThin.adjusted}`);
  assert.ok(perfectButThin.evidenceWeight < 0.1);
});

test("bayesianRating — perfect-but-thin loses to strong-and-proven", () => {
  const thinPerfect = bayesianRating({ rating: 5, ratingScale: 5, reviewCount: 3, categoryAverage: CATEGORY_AVG });
  const provenHigh = bayesianRating({ rating: 4.6, ratingScale: 5, reviewCount: 8000, categoryAverage: CATEGORY_AVG });
  assert.ok(provenHigh.adjusted > thinPerfect.adjusted, `${provenHigh.adjusted} !> ${thinPerfect.adjusted}`);
});

test("bayesianRating — missing rating falls back to the prior", () => {
  const r = bayesianRating({ rating: null, ratingScale: null, reviewCount: 0, categoryAverage: CATEGORY_AVG });
  assert.equal(r.usedPrior, true);
  assert.equal(r.adjusted, CATEGORY_AVG);
  assert.equal(r.observed, null);
});

test("bayesianRating — a rating with zero reviews is treated as unproven (prior)", () => {
  const r = bayesianRating({ rating: 4.9, ratingScale: 5, reviewCount: 0, categoryAverage: CATEGORY_AVG });
  assert.equal(r.usedPrior, true);
  assert.equal(r.adjusted, CATEGORY_AVG);
});

test("bayesianRating — normalizes different rating scales consistently", () => {
  const five = bayesianRating({ rating: 4, ratingScale: 5, reviewCount: 500, categoryAverage: 0.5 });
  const ten = bayesianRating({ rating: 8, ratingScale: 10, reviewCount: 500, categoryAverage: 0.5 });
  const hundred = bayesianRating({ rating: 80, ratingScale: 100, reviewCount: 500, categoryAverage: 0.5 });
  // 4/5 == 8/10 == 80/100 → identical adjusted values.
  assert.ok(Math.abs(five.adjusted - ten.adjusted) < 1e-9);
  assert.ok(Math.abs(ten.adjusted - hundred.adjusted) < 1e-9);
});

test("bayesianRating — invalid values fall back to the prior instead of throwing", () => {
  const negativeRating = bayesianRating({ rating: -1, ratingScale: 5, reviewCount: 10, categoryAverage: CATEGORY_AVG });
  assert.equal(negativeRating.usedPrior, true);

  const zeroScale = bayesianRating({ rating: 4, ratingScale: 0, reviewCount: 10, categoryAverage: CATEGORY_AVG });
  assert.equal(zeroScale.usedPrior, true);

  const nanReviews = bayesianRating({ rating: 4, ratingScale: 5, reviewCount: Number.NaN, categoryAverage: CATEGORY_AVG });
  assert.equal(nanReviews.usedPrior, true);
});

test("bayesianRating — result is always clamped to 0..1", () => {
  const r = bayesianRating({ rating: 5, ratingScale: 5, reviewCount: 100000, categoryAverage: 1 });
  assert.ok(r.adjusted <= 1 && r.adjusted >= 0);
});

test("bayesianRating — minConfidenceThreshold controls skepticism", () => {
  const skeptical = bayesianRating({ rating: 5, ratingScale: 5, reviewCount: 20, categoryAverage: 0.7, minConfidenceThreshold: 200 });
  const trusting = bayesianRating({ rating: 5, ratingScale: 5, reviewCount: 20, categoryAverage: 0.7, minConfidenceThreshold: 5 });
  // Higher threshold keeps more weight on the prior → lower adjusted for a high rating.
  assert.ok(skeptical.adjusted < trusting.adjusted);
});
