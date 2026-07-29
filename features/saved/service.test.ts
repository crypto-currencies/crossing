import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveEntity,
  unsaveEntity,
  isSaved,
  listSaved,
  createCollection,
  renameCollection,
  deleteCollection,
  addItemToCollection,
  removeItemFromCollection,
  moveItemBetweenCollections,
  saveInputSchema,
  slugify,
  type SavedStore,
  type SavedItemRecord,
  type CollectionRecord,
} from "./service";

/** In-memory store implementing the same contract as the Prisma-backed one. */
function makeStore(savable: string[] = ["matomo", "fathom-analytics"]): SavedStore & { items: SavedItemRecord[] } {
  const items: SavedItemRecord[] = [];
  const collections: CollectionRecord[] = [];
  const membership = new Map<string, Set<string>>(); // collectionId -> savedItemIds
  let seq = 0;

  return {
    items,
    async findSavableEntity(key) {
      return savable.includes(key) ? { id: `e_${key}`, key } : null;
    },
    async findSavedItem(userId, entityKey) {
      return items.find((i) => i.userId === userId && i.entityKey === entityKey) ?? null;
    },
    async findSavedItemById(id) {
      return items.find((i) => i.id === id) ?? null;
    },
    async createSavedItem({ userId, entityKey, note, tags }) {
      const rec: SavedItemRecord = {
        id: `s${++seq}`,
        userId,
        entityKey,
        note: note ?? null,
        tags: tags ?? [],
        createdAt: new Date(1_700_000_000_000 + seq),
      };
      items.push(rec);
      return rec;
    },
    async updateSavedItem(id, patch) {
      const rec = items.find((i) => i.id === id)!;
      if (patch.note !== undefined) rec.note = patch.note;
      if (patch.tags !== undefined) rec.tags = patch.tags;
      return rec;
    },
    async deleteSavedItem(userId, entityKey) {
      const i = items.findIndex((x) => x.userId === userId && x.entityKey === entityKey);
      if (i === -1) return false;
      items.splice(i, 1);
      return true;
    },
    async listSavedItems(userId, { limit, offset, collectionId }) {
      let mine = items.filter((i) => i.userId === userId);
      if (collectionId) {
        const ids = membership.get(collectionId) ?? new Set();
        mine = mine.filter((i) => ids.has(i.id));
      }
      return { items: mine.slice(offset, offset + limit), total: mine.length };
    },
    async findCollection(id) {
      return collections.find((c) => c.id === id) ?? null;
    },
    async listCollections(userId) {
      return collections.filter((c) => c.userId === userId);
    },
    async createCollection({ userId, name, slug }) {
      const c: CollectionRecord = { id: `c${++seq}`, userId, name, slug, position: collections.length };
      collections.push(c);
      membership.set(c.id, new Set());
      return c;
    },
    async renameCollection(id, name, slug) {
      const c = collections.find((x) => x.id === id)!;
      c.name = name;
      c.slug = slug;
      return c;
    },
    async deleteCollection(id) {
      const i = collections.findIndex((c) => c.id === id);
      if (i >= 0) collections.splice(i, 1);
      membership.delete(id);
    },
    async addToCollection(collectionId, savedItemId) {
      (membership.get(collectionId) ?? membership.set(collectionId, new Set()).get(collectionId)!).add(savedItemId);
    },
    async removeFromCollection(collectionId, savedItemId) {
      membership.get(collectionId)?.delete(savedItemId);
    },
  };
}

// ─── Save / unsave ───────────────────────────────────────────────────────────

test("saved — a save persists and reports created exactly once", async () => {
  const store = makeStore();
  const first = await saveEntity(store, "u1", { entityKey: "matomo" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.data.created, true);
  assert.equal(store.items.length, 1);

  const check = await isSaved(store, "u1", "matomo");
  assert.equal(check.ok && check.data.saved, true);
});

test("saved — save is idempotent (repeat is success, not a conflict, no duplicate row)", async () => {
  const store = makeStore();
  await saveEntity(store, "u1", { entityKey: "matomo" });
  const again = await saveEntity(store, "u1", { entityKey: "matomo", note: "second look" });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.data.created, false);
  assert.equal(again.data.item.note, "second look");
  assert.equal(store.items.length, 1, "must not create a duplicate save");
});

test("saved — unsave is idempotent", async () => {
  const store = makeStore();
  await saveEntity(store, "u1", { entityKey: "matomo" });
  const first = await unsaveEntity(store, "u1", "matomo");
  const second = await unsaveEntity(store, "u1", "matomo");
  assert.equal(first.ok && first.data.removed, true);
  assert.equal(second.ok && second.data.removed, false, "removing again still succeeds");
  assert.equal(store.items.length, 0);
});

test("saved — an unavailable entity cannot be saved (no dangling rows)", async () => {
  const store = makeStore();
  const res = await saveEntity(store, "u1", { entityKey: "deleted-thing" });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "not_found");
  assert.equal(store.items.length, 0);
});

test("saved — saves are per-user and never leak across accounts", async () => {
  const store = makeStore();
  await saveEntity(store, "u1", { entityKey: "matomo" });
  const other = await isSaved(store, "u2", "matomo");
  assert.equal(other.ok && other.data.saved, false);

  const listed = await listSaved(store, "u2", { limit: 10, offset: 0 });
  assert.equal(listed.ok && listed.data.total, 0);
});

test("saved — listing paginates", async () => {
  const store = makeStore(["a", "b", "c"]);
  for (const k of ["a", "b", "c"]) await saveEntity(store, "u1", { entityKey: k });
  const page = await listSaved(store, "u1", { limit: 2, offset: 0 });
  assert.equal(page.ok, true);
  if (!page.ok) return;
  assert.equal(page.data.items.length, 2);
  assert.equal(page.data.total, 3);
});

// ─── Collections + ownership ─────────────────────────────────────────────────

test("collections — created, renamed, and duplicate names rejected", async () => {
  const store = makeStore();
  const made = await createCollection(store, "u1", "Analytics picks");
  assert.equal(made.ok, true);
  if (!made.ok) return;
  assert.equal(made.data.slug, "analytics-picks");

  const dup = await createCollection(store, "u1", "  analytics picks ");
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.error.code, "conflict");

  const renamed = await renameCollection(store, "u1", made.data.id, "Final shortlist");
  assert.equal(renamed.ok && renamed.data.slug, "final-shortlist");
});

test("collections — another user's collection behaves as not_found (no existence probing)", async () => {
  const store = makeStore();
  const mine = await createCollection(store, "u1", "Mine");
  assert.equal(mine.ok, true);
  if (!mine.ok) return;

  for (const attempt of [
    await renameCollection(store, "u2", mine.data.id, "Stolen"),
    await deleteCollection(store, "u2", mine.data.id),
    await listSaved(store, "u2", { limit: 5, offset: 0, collectionId: mine.data.id }),
  ]) {
    assert.equal(attempt.ok, false);
    if (!attempt.ok) assert.equal(attempt.error.code, "not_found", "must not reveal that the id exists");
  }
});

test("collections — items move only between collections the caller owns", async () => {
  const store = makeStore();
  const a = await createCollection(store, "u1", "A");
  const b = await createCollection(store, "u1", "B");
  const foreign = await createCollection(store, "u2", "Theirs");
  assert.ok(a.ok && b.ok && foreign.ok);
  if (!a.ok || !b.ok || !foreign.ok) return;

  const saved = await saveEntity(store, "u1", { entityKey: "matomo", collectionId: a.data.id });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;

  const moved = await moveItemBetweenCollections(store, "u1", {
    savedItemId: saved.data.item.id,
    fromCollectionId: a.data.id,
    toCollectionId: b.data.id,
  });
  assert.equal(moved.ok, true);

  const stolen = await moveItemBetweenCollections(store, "u1", {
    savedItemId: saved.data.item.id,
    fromCollectionId: b.data.id,
    toCollectionId: foreign.data.id,
  });
  assert.equal(stolen.ok, false);
  if (!stolen.ok) assert.equal(stolen.error.code, "not_found");
});

test("collections — you cannot file another user's saved item into your own collection", async () => {
  const store = makeStore();
  // u2 saves something; u1 owns a collection.
  const theirSave = await saveEntity(store, "u2", { entityKey: "matomo" });
  const myCollection = await createCollection(store, "u1", "Mine");
  assert.ok(theirSave.ok && myCollection.ok);
  if (!theirSave.ok || !myCollection.ok) return;

  const attempt = await addItemToCollection(store, "u1", myCollection.data.id, theirSave.data.item.id);
  assert.equal(attempt.ok, false, "the saved item's owner must be checked, not just the collection's");
  if (!attempt.ok) assert.equal(attempt.error.code, "not_found");

  // The same protection applies to moves.
  const mySave = await saveEntity(store, "u1", { entityKey: "fathom-analytics" });
  const second = await createCollection(store, "u1", "Second");
  assert.ok(mySave.ok && second.ok);
  if (!mySave.ok || !second.ok) return;
  const moveTheirs = await moveItemBetweenCollections(store, "u1", {
    savedItemId: theirSave.data.item.id,
    fromCollectionId: myCollection.data.id,
    toCollectionId: second.data.id,
  });
  assert.equal(moveTheirs.ok, false);
});

test("collections — add/remove of your own item is idempotent", async () => {
  const store = makeStore();
  const saved = await saveEntity(store, "u1", { entityKey: "matomo" });
  const col = await createCollection(store, "u1", "Picks");
  assert.ok(saved.ok && col.ok);
  if (!saved.ok || !col.ok) return;

  for (let attempt = 0; attempt < 2; attempt++) {
    const added = await addItemToCollection(store, "u1", col.data.id, saved.data.item.id);
    assert.equal(added.ok, true);
  }
  const inCollection = await listSaved(store, "u1", { limit: 10, offset: 0, collectionId: col.data.id });
  assert.equal(inCollection.ok && inCollection.data.total, 1, "no duplicate membership");

  for (let attempt = 0; attempt < 2; attempt++) {
    const removed = await removeItemFromCollection(store, "u1", col.data.id, saved.data.item.id);
    assert.equal(removed.ok, true, "removing twice still succeeds");
  }
});

// ─── Validation ──────────────────────────────────────────────────────────────

test("saved — input validation rejects junk", () => {
  assert.equal(saveInputSchema.safeParse({ entityKey: "" }).success, false);
  assert.equal(saveInputSchema.safeParse({ entityKey: "x".repeat(200) }).success, false);
  assert.equal(saveInputSchema.safeParse({ entityKey: "matomo", tags: Array(50).fill("t") }).success, false);
  assert.equal(saveInputSchema.safeParse({ entityKey: "matomo", note: "ok" }).success, true);
});

test("slugify is stable and safe", () => {
  assert.equal(slugify("My  Picks!!"), "my-picks");
  assert.equal(slugify("***"), "collection");
});
