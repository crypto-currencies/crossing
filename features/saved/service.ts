/**
 * Saved items + collections (Part 4).
 *
 * Distinct from the legacy `Save` model (which bookmarks a `Listing`): this
 * saves a recommendation `Entity` — the thing search actually returns.
 *
 * Guarantees:
 *   - Save/unsave are IDEMPOTENT; repeating either is a success, not an error.
 *   - Ownership is enforced server-side on every read and write. A collection id
 *     belonging to another user behaves exactly like a missing one (no probing).
 *   - The caller only ever receives success AFTER the write commits.
 *   - Saving an entity that is missing/inactive fails loudly rather than
 *     creating a dangling row.
 */

import { z } from "zod";
import { fail, ok, type Result } from "@/lib/server/api-result";

// ─── Validation ───────────────────────────────────────────────────────────────

export const saveInputSchema = z.object({
  entityKey: z.string().trim().min(1).max(64),
  note: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  sourceQuery: z.string().trim().max(300).optional(),
  collectionId: z.string().trim().min(1).max(64).optional(),
});
export type SaveInput = z.infer<typeof saveInputSchema>;

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const listQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(24),
  offset: z.number().int().min(0).default(0),
  collectionId: z.string().trim().min(1).max(64).optional(),
});

// ─── Ports (kept narrow so tests need no database) ────────────────────────────

export interface SavedItemRecord {
  id: string;
  userId: string;
  entityKey: string;
  note: string | null;
  tags: string[];
  createdAt: Date;
}

export interface CollectionRecord {
  id: string;
  userId: string;
  name: string;
  slug: string;
  position: number;
}

export interface SavedStore {
  /** Resolve an entity that is eligible to be saved. Null when missing/inactive. */
  findSavableEntity(entityKey: string): Promise<{ id: string; key: string } | null>;
  findSavedItem(userId: string, entityKey: string): Promise<SavedItemRecord | null>;
  /** Look up by primary key so collection membership can verify ownership. */
  findSavedItemById(id: string): Promise<SavedItemRecord | null>;
  createSavedItem(input: {
    userId: string;
    entityKey: string;
    note?: string;
    tags?: string[];
    sourceQuery?: string;
  }): Promise<SavedItemRecord>;
  updateSavedItem(id: string, patch: { note?: string; tags?: string[] }): Promise<SavedItemRecord>;
  deleteSavedItem(userId: string, entityKey: string): Promise<boolean>;
  listSavedItems(userId: string, opts: { limit: number; offset: number; collectionId?: string }): Promise<{
    items: SavedItemRecord[];
    total: number;
  }>;

  findCollection(id: string): Promise<CollectionRecord | null>;
  listCollections(userId: string): Promise<CollectionRecord[]>;
  createCollection(input: { userId: string; name: string; slug: string }): Promise<CollectionRecord>;
  renameCollection(id: string, name: string, slug: string): Promise<CollectionRecord>;
  deleteCollection(id: string): Promise<void>;
  addToCollection(collectionId: string, savedItemId: string): Promise<void>;
  removeFromCollection(collectionId: string, savedItemId: string): Promise<void>;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "collection"
  );
}

// ─── Operations ───────────────────────────────────────────────────────────────

export interface SavedItemView {
  id: string;
  entityKey: string;
  note: string | null;
  tags: string[];
  createdAt: string;
}

function toView(r: SavedItemRecord): SavedItemView {
  return { id: r.id, entityKey: r.entityKey, note: r.note, tags: r.tags, createdAt: r.createdAt.toISOString() };
}

/**
 * Idempotent save. Re-saving an already-saved entity updates the note/tags and
 * still reports success (`created: false`) rather than a conflict.
 */
export async function saveEntity(
  store: SavedStore,
  userId: string,
  input: SaveInput
): Promise<Result<{ item: SavedItemView; created: boolean }>> {
  const entity = await store.findSavableEntity(input.entityKey);
  if (!entity) {
    return fail("not_found", "That option is no longer available to save.");
  }

  const existing = await store.findSavedItem(userId, input.entityKey);
  if (existing) {
    const patched =
      input.note !== undefined || input.tags !== undefined
        ? await store.updateSavedItem(existing.id, { note: input.note, tags: input.tags })
        : existing;
    if (input.collectionId) {
      const owned = await requireOwnedCollection(store, userId, input.collectionId);
      if (!owned.ok) return owned;
      await store.addToCollection(input.collectionId, patched.id);
    }
    return ok({ item: toView(patched), created: false });
  }

  const created = await store.createSavedItem({
    userId,
    entityKey: input.entityKey,
    note: input.note,
    tags: input.tags,
    sourceQuery: input.sourceQuery,
  });

  if (input.collectionId) {
    const owned = await requireOwnedCollection(store, userId, input.collectionId);
    if (!owned.ok) return owned;
    await store.addToCollection(input.collectionId, created.id);
  }

  return ok({ item: toView(created), created: true });
}

/** Idempotent unsave — removing something already gone is still a success. */
export async function unsaveEntity(
  store: SavedStore,
  userId: string,
  entityKey: string
): Promise<Result<{ removed: boolean }>> {
  const removed = await store.deleteSavedItem(userId, entityKey);
  return ok({ removed });
}

export async function isSaved(store: SavedStore, userId: string, entityKey: string): Promise<Result<{ saved: boolean }>> {
  const found = await store.findSavedItem(userId, entityKey);
  return ok({ saved: found !== null });
}

export async function listSaved(
  store: SavedStore,
  userId: string,
  query: { limit: number; offset: number; collectionId?: string }
): Promise<Result<{ items: SavedItemView[]; total: number; limit: number; offset: number }>> {
  if (query.collectionId) {
    const owned = await requireOwnedCollection(store, userId, query.collectionId);
    if (!owned.ok) return owned;
  }
  const { items, total } = await store.listSavedItems(userId, query);
  return ok({ items: items.map(toView), total, limit: query.limit, offset: query.offset });
}

// ─── Collections ──────────────────────────────────────────────────────────────

/**
 * Ownership gate. A collection owned by someone else is reported as `not_found`,
 * never `forbidden` — otherwise the response leaks that the id exists.
 */
async function requireOwnedCollection(
  store: SavedStore,
  userId: string,
  collectionId: string
): Promise<Result<CollectionRecord>> {
  const collection = await store.findCollection(collectionId);
  if (!collection || collection.userId !== userId) {
    return fail("not_found", "Collection not found.");
  }
  return ok(collection);
}

export async function createCollection(
  store: SavedStore,
  userId: string,
  name: string
): Promise<Result<CollectionRecord>> {
  const existing = await store.listCollections(userId);
  const slug = slugify(name);
  if (existing.some((c) => c.slug === slug)) {
    return fail("conflict", "You already have a collection with that name.");
  }
  return ok(await store.createCollection({ userId, name: name.trim(), slug }));
}

export async function renameCollection(
  store: SavedStore,
  userId: string,
  collectionId: string,
  name: string
): Promise<Result<CollectionRecord>> {
  const owned = await requireOwnedCollection(store, userId, collectionId);
  if (!owned.ok) return owned;

  const slug = slugify(name);
  const others = (await store.listCollections(userId)).filter((c) => c.id !== collectionId);
  if (others.some((c) => c.slug === slug)) {
    return fail("conflict", "You already have a collection with that name.");
  }
  return ok(await store.renameCollection(collectionId, name.trim(), slug));
}

export async function deleteCollection(
  store: SavedStore,
  userId: string,
  collectionId: string
): Promise<Result<{ deleted: true }>> {
  const owned = await requireOwnedCollection(store, userId, collectionId);
  if (!owned.ok) return owned;
  await store.deleteCollection(collectionId);
  return ok({ deleted: true as const });
}

/**
 * Ownership gate for a saved item. Like collections, another user's item is
 * reported as `not_found` so ids can't be probed. Without this, a caller could
 * add someone else's saved item into their own collection.
 */
async function requireOwnedSavedItem(
  store: SavedStore,
  userId: string,
  savedItemId: string
): Promise<Result<SavedItemRecord>> {
  const item = await store.findSavedItemById(savedItemId);
  if (!item || item.userId !== userId) {
    return fail("not_found", "Saved item not found.");
  }
  return ok(item);
}

/** Idempotent: adding an item already in the collection succeeds unchanged. */
export async function addItemToCollection(
  store: SavedStore,
  userId: string,
  collectionId: string,
  savedItemId: string
): Promise<Result<{ added: true }>> {
  const collection = await requireOwnedCollection(store, userId, collectionId);
  if (!collection.ok) return collection;
  const item = await requireOwnedSavedItem(store, userId, savedItemId);
  if (!item.ok) return item;

  await store.addToCollection(collectionId, savedItemId);
  return ok({ added: true as const });
}

/** Idempotent: removing an item that isn't in the collection still succeeds. */
export async function removeItemFromCollection(
  store: SavedStore,
  userId: string,
  collectionId: string,
  savedItemId: string
): Promise<Result<{ removed: true }>> {
  const collection = await requireOwnedCollection(store, userId, collectionId);
  if (!collection.ok) return collection;
  const item = await requireOwnedSavedItem(store, userId, savedItemId);
  if (!item.ok) return item;

  await store.removeFromCollection(collectionId, savedItemId);
  return ok({ removed: true as const });
}

export async function moveItemBetweenCollections(
  store: SavedStore,
  userId: string,
  args: { savedItemId: string; fromCollectionId: string; toCollectionId: string }
): Promise<Result<{ moved: true }>> {
  const from = await requireOwnedCollection(store, userId, args.fromCollectionId);
  if (!from.ok) return from;
  const to = await requireOwnedCollection(store, userId, args.toCollectionId);
  if (!to.ok) return to;
  // The item itself must belong to the caller, not just the two collections.
  const item = await requireOwnedSavedItem(store, userId, args.savedItemId);
  if (!item.ok) return item;

  await store.removeFromCollection(args.fromCollectionId, args.savedItemId);
  await store.addToCollection(args.toCollectionId, args.savedItemId);
  return ok({ moved: true as const });
}
