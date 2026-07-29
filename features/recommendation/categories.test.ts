import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCategory, getCategory, getCategoryAttribute, listCategories } from "./categories/definitions";

test("categories — all seven MVP categories exist", () => {
  const ids = listCategories().map((c) => c.id);
  for (const id of [
    "developer-tools",
    "ai-tools",
    "productivity-tools",
    "design-tools",
    "hosting-platforms",
    "email-platforms",
    "analytics-tools",
  ]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});

test("categories — every category's positive weights are sensible (sum ≈ 1)", () => {
  for (const c of listCategories()) {
    const w = c.weights;
    const sum =
      w.constraintFit +
      w.queryRelevance +
      w.semanticRelevance +
      w.generalQuality +
      w.reviewConfidence +
      w.topicSentiment +
      w.sourceDiversity +
      w.freshness;
    assert.ok(sum > 0.8 && sum < 1.2, `${c.id} positive weight sum ${sum}`);
  }
});

test("detectCategory — resolves an alias", () => {
  assert.equal(detectCategory("looking for a code editor").categoryId, "developer-tools");
  assert.equal(detectCategory("need a newsletter tool").categoryId, "email-platforms");
});

test("detectCategory — returns null with zero confidence when nothing matches", () => {
  const res = detectCategory("blue whimsical thing");
  assert.equal(res.categoryId, null);
  assert.equal(res.confidence, 0);
});

test("getCategoryAttribute — resolves a declared attribute", () => {
  const attr = getCategoryAttribute("analytics-tools", "openSource");
  assert.ok(attr);
  assert.equal(attr?.hardFilterable, true);
});

test("getCategory — unknown id returns undefined", () => {
  assert.equal(getCategory("not-a-category"), undefined);
});
