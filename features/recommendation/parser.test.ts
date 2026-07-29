import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicParser, parseQuerySafe, type QueryParser } from "./query/parser";
import { parsedQuerySchema } from "./query/schema";

test("parser — output always validates against the schema", async () => {
  const parsed = await deterministicParser.parse("best open source analytics tool under $20");
  assert.doesNotThrow(() => parsedQuerySchema.parse(parsed));
});

test("parser — detects category from a keyword", async () => {
  const parsed = await deterministicParser.parse("a good hosting platform for a startup");
  assert.equal(parsed.categoryId, "hosting-platforms");
});

test("parser — unknown category is recorded as an ambiguity, not guessed", async () => {
  const parsed = await deterministicParser.parse("something nice please");
  assert.equal(parsed.categoryId, null);
  assert.ok(parsed.ambiguities.length > 0);
});

test("parser — extracts a budget from 'under $N'", async () => {
  const parsed = await deterministicParser.parse("email platform under $25");
  assert.equal(parsed.budget?.max, 25);
  assert.equal(parsed.budget?.billingPeriod, "month");
});

test("parser — extracts hard constraints for open source + self-host", async () => {
  const parsed = await deterministicParser.parse("open source self-hosted analytics tool");
  const attrs = parsed.hardConstraints.map((c) => c.attribute);
  assert.ok(attrs.includes("openSource"));
  assert.ok(attrs.includes("selfHostable"));
});

test("parser — extracts negative preferences from 'no/without'", async () => {
  const parsed = await deterministicParser.parse("productivity tool without bloat");
  assert.ok(parsed.negativePreferences.some((p) => p.value === "bloat"));
});

test("parser — detects comparison intent", async () => {
  const parsed = await deterministicParser.parse("compare developer tools");
  assert.equal(parsed.intent, "comparison");
});

test("parser — parses a requested result count ('top 5')", async () => {
  const parsed = await deterministicParser.parse("top 5 design tools");
  assert.equal(parsed.requestedResultCount, 5);
});

test("parser — confidence stays below 1 (a rules parser never claims certainty)", async () => {
  const parsed = await deterministicParser.parse("developer tools");
  assert.ok(parsed.confidence < 1);
  assert.ok(parsed.confidence > 0);
});

test("parseQuerySafe — falls back to a minimal valid query when a parser throws", async () => {
  const brokenParser: QueryParser = {
    name: "broken",
    async parse() {
      throw new Error("boom");
    },
  };
  const parsed = await parseQuerySafe(brokenParser, "hosting platform");
  assert.doesNotThrow(() => parsedQuerySchema.parse(parsed));
  assert.ok(parsed.confidence <= 0.1);
  // Category detection is still attempted even on the fallback path.
  assert.equal(parsed.categoryId, "hosting-platforms");
});
