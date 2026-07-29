/**
 * Wiring test: FEATURE_DB_ENTITIES swaps candidate retrieval in
 * runRecommendation from the demo fixture corpus to PrismaEntityRepository —
 * hermetically, via the same DI seam production uses (setDefaultEntityRepository),
 * never a live database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { runRecommendation } from "@/features/recommendation/recommend";
import { PrismaEntityRepository, type EntityDelegate, type PrismaEntityRow } from "./repository";
import { createEvidenceLoader, type EvidenceSnapshotDelegate } from "./evidence-loader";
import { getDefaultEntityRepository, setDefaultEntityRepository } from "./default-repository";

const NOW = new Date("2026-07-20T00:00:00Z");

function row(over: Partial<PrismaEntityRow> = {}): PrismaEntityRow {
  return {
    id: "c1",
    key: "matomo",
    canonicalName: "Matomo",
    categoryId: "analytics-tools",
    officialDomain: "matomo.org",
    domainKey: "matomo.org",
    description: "Open-source analytics.",
    attributes: { hasFreePlan: true, platforms: "web" },
    status: "ACTIVE",
    source: "CANONICAL",
    lastUpdatedAt: NOW,
    aliases: [],
    externalIds: [],
    ...over,
  };
}

function fakeEntityDelegate(rows: PrismaEntityRow[]): EntityDelegate {
  return {
    async findMany(args) {
      const w = (args as { where: { categoryId?: string; status?: { in: string[] }; source?: string } }).where;
      return rows.filter(
        (r) =>
          (!w.categoryId || r.categoryId === w.categoryId) &&
          (!w.status || w.status.in.includes(r.status)) &&
          (!w.source || r.source === w.source)
      );
    },
    async count(args) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await (this as any).findMany(args)).length;
    },
    async findUnique(args) {
      const key = (args as { where: { key: string } }).where.key;
      return rows.find((r) => r.key === key) ?? null;
    },
  };
}

function fakeEvidenceDelegate(): EvidenceSnapshotDelegate {
  return { async findMany() { return []; } };
}

function withFlag(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const prev = process.env.FEATURE_DB_ENTITIES;
    process.env.FEATURE_DB_ENTITIES = "on";
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.FEATURE_DB_ENTITIES;
      else process.env.FEATURE_DB_ENTITIES = prev;
      setDefaultEntityRepository(null);
    }
  };
}

test(
  "wiring — flag off: runRecommendation still uses the fixture corpus (no regression)",
  async () => {
    delete process.env.FEATURE_DB_ENTITIES;
    const result = await runRecommendation("developer tools", { now: NOW });
    assert.equal(result.diagnostics?.candidateSource, "fixture");
    assert.ok(result.best, "fixture corpus should still yield a result");
  }
);

test(
  "wiring — flag on: candidates come from the DB repository, not fixtures",
  withFlag(async () => {
    const delegate = fakeEntityDelegate([row()]);
    const repo = new PrismaEntityRepository(delegate, createEvidenceLoader(fakeEvidenceDelegate()));
    setDefaultEntityRepository(repo);

    const result = await runRecommendation("best analytics tool", { now: NOW });
    assert.equal(result.diagnostics?.candidateSource, "db");
    assert.equal(result.categoryId, "analytics-tools");
    assert.equal(result.best?.entityId, "matomo", "the DB row, not a fixture id, should win");
  })
);

test(
  "wiring — flag on: DRAFT/HIDDEN/ARCHIVED and DEMO-source rows never reach ranking",
  withFlag(async () => {
    const delegate = fakeEntityDelegate([
      row({ key: "matomo", status: "ACTIVE", source: "CANONICAL" }),
      row({ id: "c2", key: "draft-one", status: "DRAFT", source: "CANONICAL", domainKey: "d.example" }),
      row({ id: "c3", key: "fictional-one", status: "ACTIVE", source: "DEMO", domainKey: "f.example" }),
    ]);
    const repo = new PrismaEntityRepository(delegate, createEvidenceLoader(fakeEvidenceDelegate()));
    setDefaultEntityRepository(repo);

    const result = await runRecommendation("best analytics tool", { now: NOW });
    const ids = [result.best, ...result.alternatives, ...result.ineligible].filter(Boolean).map((x) => x!.entityId);
    assert.deepEqual(ids, ["matomo"]);
  })
);

test(
  "wiring — category isolation holds through the DB path",
  withFlag(async () => {
    const delegate = fakeEntityDelegate([
      row({ key: "matomo", categoryId: "analytics-tools" }),
      row({ id: "c2", key: "some-host", categoryId: "hosting-platforms", domainKey: "h.example" }),
    ]);
    const repo = new PrismaEntityRepository(delegate, createEvidenceLoader(fakeEvidenceDelegate()));
    setDefaultEntityRepository(repo);

    const result = await runRecommendation("best analytics tool", { now: NOW });
    assert.equal(result.categoryId, "analytics-tools");
    const ids = [result.best, ...result.alternatives].filter(Boolean).map((x) => x!.entityId);
    assert.ok(!ids.includes("some-host"));
  })
);

test(
  "wiring — an explicitly injected corpus always wins over the DB flag",
  withFlag(async () => {
    const delegate = fakeEntityDelegate([row()]);
    setDefaultEntityRepository(new PrismaEntityRepository(delegate, createEvidenceLoader(fakeEvidenceDelegate())));

    const { buildFixtures } = await import("@/features/recommendation/fixtures");
    const result = await runRecommendation("developer tools", { now: NOW, corpus: buildFixtures(NOW) });
    assert.equal(result.diagnostics?.candidateSource, "fixture", "an injected corpus must not be swapped for DB data");
  })
);

test("default-repository — the singleton is memoized and overridable for tests", () => {
  const a = getDefaultEntityRepository();
  const b = getDefaultEntityRepository();
  assert.equal(a, b, "must be memoized, not rebuilt per call");
  setDefaultEntityRepository(null);
});
