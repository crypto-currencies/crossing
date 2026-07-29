import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PrismaEntityRepository,
  FixtureEntityRepository,
  stableOrder,
  rowToEntity,
  type PrismaEntityRow,
  type EntityDelegate,
} from "./repository";
import { buildFixtures } from "@/features/recommendation/fixtures";

const NOW = new Date("2026-07-20T00:00:00Z");

function row(over: Partial<PrismaEntityRow> = {}): PrismaEntityRow {
  return {
    id: "c_1",
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
    aliases: [{ alias: "piwik" }],
    externalIds: [],
    ...over,
  };
}

/** Records the `where` it was called with so we can assert the query itself. */
function makeDelegate(rows: PrismaEntityRow[]) {
  const calls: Record<string, unknown>[] = [];
  const delegate: EntityDelegate = {
    async findMany(args) {
      const a = args as { where: Record<string, unknown> };
      calls.push(a.where);
      return rows.filter((r) => {
        const w = a.where as { categoryId?: string; status?: { in: string[] }; source?: string };
        if (w.categoryId && r.categoryId !== w.categoryId) return false;
        if (w.status && !w.status.in.includes(r.status)) return false;
        if (w.source && r.source !== w.source) return false;
        return true;
      });
    },
    async count(args) {
      return (await delegate.findMany(args)).length;
    },
    async findUnique(args) {
      const key = (args as { where: { key: string } }).where.key;
      return rows.find((r) => r.key === key) ?? null;
    },
  };
  return { delegate, calls };
}

// ─── Production safety ───────────────────────────────────────────────────────

test("repository — production retrieval excludes DEMO rows at the query level", async () => {
  const { delegate, calls } = makeDelegate([
    row({ key: "matomo", source: "CANONICAL" }),
    row({ id: "c_2", key: "glyph-code-demo", source: "DEMO", domainKey: "glyph.demo" }),
  ]);
  const repo = new PrismaEntityRepository(delegate);
  const page = await repo.findCandidates({ categoryId: "analytics-tools" });

  assert.equal(page.entities.length, 1);
  assert.equal(page.entities[0].id, "matomo");
  assert.equal(page.source, "CANONICAL");
  // Enforced in the WHERE clause, not by post-filtering.
  assert.equal(calls[0].source, "CANONICAL");
});

test("repository — only ACTIVE entities are returned by default", async () => {
  const { delegate, calls } = makeDelegate([
    row({ key: "active-one", status: "ACTIVE", domainKey: "a.com" }),
    row({ id: "c_2", key: "draft-one", status: "DRAFT", domainKey: "b.com" }),
    row({ id: "c_3", key: "archived-one", status: "ARCHIVED", domainKey: "c.com" }),
  ]);
  const repo = new PrismaEntityRepository(delegate);
  const page = await repo.findCandidates({ categoryId: "analytics-tools" });

  assert.deepEqual(page.entities.map((e) => e.id), ["active-one"]);
  assert.deepEqual((calls[0].status as { in: string[] }).in, ["ACTIVE"]);
});

test("repository — a fixture repo refuses to serve a production (canonical) caller", async () => {
  const repo = new FixtureEntityRepository(buildFixtures(NOW));
  const page = await repo.findCandidates({ categoryId: "analytics-tools", requireCanonical: true });
  assert.deepEqual(page.entities, [], "fictional data must never satisfy a production request");
  assert.equal(page.source, "DEMO");
});

test("repository — fixtures still work for hermetic tests", async () => {
  const repo = new FixtureEntityRepository(buildFixtures(NOW));
  const page = await repo.findCandidates({ categoryId: "analytics-tools" });
  assert.ok(page.entities.length > 0);
  assert.equal(page.source, "DEMO");
});

// ─── Category isolation ──────────────────────────────────────────────────────

test("repository — category isolation holds in both implementations", async () => {
  const { delegate } = makeDelegate([
    row({ key: "matomo", categoryId: "analytics-tools" }),
    row({ id: "c_2", key: "somehost", categoryId: "hosting-platforms", domainKey: "h.com" }),
  ]);
  const prisma = new PrismaEntityRepository(delegate);
  const page = await prisma.findCandidates({ categoryId: "analytics-tools" });
  assert.ok(page.entities.every((e) => e.categoryId === "analytics-tools"));

  const fixture = new FixtureEntityRepository(buildFixtures(NOW));
  const fpage = await fixture.findCandidates({ categoryId: "hosting-platforms" });
  assert.ok(fpage.entities.length > 0);
  assert.ok(fpage.entities.every((e) => e.categoryId === "hosting-platforms"));
});

// ─── Ordering, pagination, filtering, evidence ───────────────────────────────

test("repository — ordering is deterministic before ranking", async () => {
  const a = buildFixtures(NOW);
  const shuffled = [...a].reverse();
  assert.deepEqual(stableOrder(a).map((e) => e.id), stableOrder(shuffled).map((e) => e.id));
});

test("repository — attribute filtering and pagination", async () => {
  const repo = new FixtureEntityRepository(buildFixtures(NOW));
  const free = await repo.findCandidates({ categoryId: "analytics-tools", attributes: { hasFreePlan: true } });
  assert.ok(free.entities.every((e) => String(e.attributes.hasFreePlan) === "true"));

  const paged = await repo.findCandidates({ categoryId: "analytics-tools", limit: 1, offset: 0 });
  assert.equal(paged.entities.length, 1);
  assert.ok(paged.total >= 1);
});

test("repository — evidence is loaded in ONE batched call, not per entity (no N+1)", async () => {
  const { delegate } = makeDelegate([
    row({ key: "matomo", domainKey: "matomo.org" }),
    row({ id: "c_2", key: "fathom-analytics", domainKey: "usefathom.com" }),
  ]);
  let loaderCalls = 0;
  const repo = new PrismaEntityRepository(delegate, async (keys) => {
    loaderCalls++;
    return new Map(keys.map((k) => [k, []]));
  });

  const page = await repo.findCandidates({ categoryId: "analytics-tools" });
  assert.equal(page.entities.length, 2);
  assert.equal(loaderCalls, 1, "evidence must be loaded once for the whole page");
});

test("repository — a DB row maps onto the engine's Entity shape", () => {
  const entity = rowToEntity(row());
  assert.equal(entity.id, "matomo", "engine keys off the stable public key");
  assert.equal(entity.canonicalName, "Matomo");
  assert.deepEqual(entity.aliases, ["piwik"]);
  assert.equal(entity.categoryId, "analytics-tools");
  assert.equal(typeof entity.lastUpdatedAt, "string");
});
