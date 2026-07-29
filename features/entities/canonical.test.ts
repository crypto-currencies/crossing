import { test } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_ENTITIES, activeCanonicalKeys, canonicalByKey } from "./canonical";
import { getApprovedSource, PILOT_ENTITY_IDS } from "@/features/ingestion/registry";
import { buildFixtures } from "@/features/recommendation/fixtures";
import { isEnabled } from "@/lib/server/feature-flags";

test("canonical — every canonical entity is a real pilot vendor, never a fixture", () => {
  const fictionalKeys = new Set(buildFixtures(new Date()).map((e) => e.id));
  for (const e of CANONICAL_ENTITIES) {
    assert.ok(!fictionalKeys.has(e.key), `fictional fixture promoted to canonical: ${e.key}`);
    // Each must correspond to an approved ingestion source, so evidence can be tied to it.
    const source = getApprovedSource(e.key);
    assert.ok(source, `${e.key} has no approved ingestion source`);
    assert.equal(source!.categoryId, e.categoryId, `${e.key} category must match its ingestion source`);
    assert.equal(source!.canonicalDomain, e.officialDomain);
  }
});

test("canonical — the set matches the approved pilot exactly (no silent additions)", () => {
  assert.deepEqual(
    CANONICAL_ENTITIES.map((e) => e.key).sort(),
    [...PILOT_ENTITY_IDS].sort()
  );
});

test("canonical — readiness gates status: Fathom/Matomo ACTIVE, Plausible held in DRAFT", () => {
  assert.equal(canonicalByKey("fathom-analytics")!.status, "ACTIVE");
  assert.equal(canonicalByKey("matomo")!.status, "ACTIVE");
  assert.equal(
    canonicalByKey("plausible-analytics")!.status,
    "DRAFT",
    "Plausible must stay out of production ranking until evidence readiness passes"
  );
  assert.deepEqual(activeCanonicalKeys().sort(), ["fathom-analytics", "matomo"]);
});

test("canonical — every status decision records why (auditable)", () => {
  for (const e of CANONICAL_ENTITIES) {
    assert.match(e.readinessNote, /Readiness=/, `${e.key} must record its readiness basis`);
  }
});

test("canonical — no fabricated rating, review, or score data is seeded", () => {
  const forbidden = ["rating", "ratingscale", "reviewcount", "reviews", "score", "ranking", "popularity", "trending"];
  for (const e of CANONICAL_ENTITIES) {
    for (const key of Object.keys(e.attributes)) {
      assert.ok(
        !forbidden.includes(key.toLowerCase()),
        `${e.key} seeds an independent signal Crossing must compute itself: ${key}`
      );
    }
  }
});

test("canonical — DB-backed retrieval stays behind its feature flag by default", () => {
  assert.equal(isEnabled("FEATURE_DB_ENTITIES", { NODE_ENV: "test" } as NodeJS.ProcessEnv), false);
});
