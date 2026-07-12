import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "./slug";

test("slugify — lowercases and hyphenates", () => {
  assert.equal(slugify("Node.js & TypeScript"), "node-js-typescript");
});

test("slugify — strips diacritics", () => {
  assert.equal(slugify("Café Résumé"), "cafe-resume");
});

test("slugify — collapses whitespace and punctuation runs", () => {
  assert.equal(slugify("  Hello   World!!  "), "hello-world");
});

test("slugify — trims leading/trailing hyphens", () => {
  assert.equal(slugify("---already-slugged---"), "already-slugged");
});

test("slugify — caps length at 64 chars without a trailing hyphen", () => {
  const long = "a".repeat(100);
  const result = slugify(long);
  assert.ok(result.length <= 64);
  assert.ok(!result.endsWith("-"));
});

test("uniqueSlug — returns the base when it doesn't collide", async () => {
  const result = await uniqueSlug("figma", async () => false);
  assert.equal(result, "figma");
});

test("uniqueSlug — appends -2, -3, ... until free", async () => {
  const taken = new Set(["figma", "figma-2", "figma-3"]);
  const result = await uniqueSlug("figma", async (c) => taken.has(c));
  assert.equal(result, "figma-4");
});

test("uniqueSlug — falls back to 'listing' for an empty base", async () => {
  const result = await uniqueSlug("", async () => false);
  assert.equal(result, "listing");
});
