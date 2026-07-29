import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAlias, normalizeDomainKey, resolveEntities } from "./entities/normalize";
import type { Entity } from "./entities/types";

function e(id: string, domainKey: string, aliases: string[] = []): Entity {
  return {
    id,
    canonicalName: id,
    officialDomain: domainKey,
    domainKey,
    categoryId: "developer-tools",
    aliases,
    description: "",
    attributes: {},
    externalIds: [],
    evidence: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

test("normalizeDomainKey — accepts a bare host and a full URL identically", () => {
  assert.equal(normalizeDomainKey("vercel.com"), normalizeDomainKey("https://www.vercel.com/"));
});

test("normalizeAlias — lowercases, strips symbols, collapses whitespace", () => {
  assert.equal(normalizeAlias("  PostgreSQL®  "), "postgresql");
  assert.equal(normalizeAlias("C++"), "c++");
});

test("resolveEntities — merges entities that share a domain key (no fuzzy name merge)", () => {
  const merged = resolveEntities([e("a", "tool.com", ["a1"]), e("b", "tool.com", ["b1"])]);
  assert.equal(merged.length, 1);
  assert.deepEqual(new Set(merged[0].aliases), new Set(["a1", "b1"]));
});

test("resolveEntities — keeps entities with different keys separate", () => {
  const out = resolveEntities([e("a", "one.com"), e("b", "two.com")]);
  assert.equal(out.length, 2);
});

test("resolveEntities — never merges on name similarity alone", () => {
  // Same display-ish name, different domains → must stay distinct.
  const out = resolveEntities([e("notion-a", "notion.so"), e("notion-b", "notion.com")]);
  assert.equal(out.length, 2);
});
