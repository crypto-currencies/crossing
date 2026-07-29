/**
 * Prisma implementation of the `SavedStore` port (features/saved/service.ts).
 *
 * The service owns all policy (idempotency, ownership, validation); this layer
 * only translates that contract to SQL. Two details matter:
 *
 *   1. The service speaks in `entityKey` (the stable public key like "matomo"),
 *      never the cuid. Mapping happens here via Prisma's unique-field connect,
 *      so a save is a single statement rather than lookup-then-insert.
 *   2. An entity is savable only when it is ACTIVE. In production it must also
 *      be CANONICAL, so fictional demo rows can never end up in a user's saves.
 */

import { db } from "@/lib/db";
import type { CollectionRecord, SavedItemRecord, SavedStore } from "./service";

/** Row shape we select for a saved item (entity joined for its public key). */
interface SavedRow {
  id: string;
  userId: string;
  note: string | null;
  tags: string[];
  createdAt: Date;
  entity: { key: string };
}

function toRecord(row: SavedRow): SavedItemRecord {
  return {
    id: row.id,
    userId: row.userId,
    entityKey: row.entity.key,
    note: row.note,
    tags: row.tags,
    createdAt: row.createdAt,
  };
}

const SAVED_SELECT = {
  id: true,
  userId: true,
  note: true,
  tags: true,
  createdAt: true,
  entity: { select: { key: true } },
} as const;

export interface PrismaSavedStoreOptions {
  /** When true, only CANONICAL entities may be saved. Defaults to prod-only. */
  requireCanonical?: boolean;
}

export class PrismaSavedStore implements SavedStore {
  private readonly requireCanonical: boolean;

  constructor(options: PrismaSavedStoreOptions = {}) {
    this.requireCanonical = options.requireCanonical ?? process.env.NODE_ENV === "production";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get client(): any {
    return db;
  }

  async findSavableEntity(entityKey: string): Promise<{ id: string; key: string } | null> {
    const row = await this.client.entity.findFirst({
      where: {
        key: entityKey,
        status: "ACTIVE",
        ...(this.requireCanonical ? { source: "CANONICAL" } : {}),
      },
      select: { id: true, key: true },
    });
    return row ?? null;
  }

  async findSavedItem(userId: string, entityKey: string): Promise<SavedItemRecord | null> {
    const row = await this.client.savedItem.findFirst({
      where: { userId, entity: { key: entityKey } },
      select: SAVED_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async findSavedItemById(id: string): Promise<SavedItemRecord | null> {
    const row = await this.client.savedItem.findUnique({ where: { id }, select: SAVED_SELECT });
    return row ? toRecord(row) : null;
  }

  async createSavedItem(input: {
    userId: string;
    entityKey: string;
    note?: string;
    tags?: string[];
    sourceQuery?: string;
  }): Promise<SavedItemRecord> {
    const row = await this.client.savedItem.create({
      data: {
        user: { connect: { id: input.userId } },
        // Connect by the unique public key — no separate lookup round-trip.
        entity: { connect: { key: input.entityKey } },
        note: input.note ?? null,
        tags: input.tags ?? [],
        sourceQuery: input.sourceQuery ?? null,
      },
      select: SAVED_SELECT,
    });
    return toRecord(row);
  }

  async updateSavedItem(id: string, patch: { note?: string; tags?: string[] }): Promise<SavedItemRecord> {
    const row = await this.client.savedItem.update({
      where: { id },
      data: {
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      },
      select: SAVED_SELECT,
    });
    return toRecord(row);
  }

  /** Returns false when nothing was there — the service treats that as success. */
  async deleteSavedItem(userId: string, entityKey: string): Promise<boolean> {
    const result = await this.client.savedItem.deleteMany({
      where: { userId, entity: { key: entityKey } },
    });
    return result.count > 0;
  }

  async listSavedItems(
    userId: string,
    opts: { limit: number; offset: number; collectionId?: string }
  ): Promise<{ items: SavedItemRecord[]; total: number }> {
    const where = {
      userId,
      ...(opts.collectionId ? { collectionItems: { some: { collectionId: opts.collectionId } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.client.savedItem.findMany({
        where,
        select: SAVED_SELECT,
        orderBy: { createdAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
      }),
      this.client.savedItem.count({ where }),
    ]);

    return { items: (rows as SavedRow[]).map(toRecord), total };
  }

  // ─── Collections ────────────────────────────────────────────────────────────

  async findCollection(id: string): Promise<CollectionRecord | null> {
    const row = await this.client.collection.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, slug: true, position: true },
    });
    return row ?? null;
  }

  async listCollections(userId: string): Promise<CollectionRecord[]> {
    return this.client.collection.findMany({
      where: { userId },
      select: { id: true, userId: true, name: true, slug: true, position: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async createCollection(input: { userId: string; name: string; slug: string }): Promise<CollectionRecord> {
    const position = await this.client.collection.count({ where: { userId: input.userId } });
    return this.client.collection.create({
      data: { userId: input.userId, name: input.name, slug: input.slug, position },
      select: { id: true, userId: true, name: true, slug: true, position: true },
    });
  }

  async renameCollection(id: string, name: string, slug: string): Promise<CollectionRecord> {
    return this.client.collection.update({
      where: { id },
      data: { name, slug },
      select: { id: true, userId: true, name: true, slug: true, position: true },
    });
  }

  async deleteCollection(id: string): Promise<void> {
    await this.client.collection.delete({ where: { id } });
  }

  /** Idempotent: adding an item already in the collection is a no-op. */
  async addToCollection(collectionId: string, savedItemId: string): Promise<void> {
    const position = await this.client.collectionItem.count({ where: { collectionId } });
    await this.client.collectionItem.upsert({
      where: { collectionId_savedItemId: { collectionId, savedItemId } },
      create: { collectionId, savedItemId, position },
      update: {},
    });
  }

  async removeFromCollection(collectionId: string, savedItemId: string): Promise<void> {
    await this.client.collectionItem.deleteMany({ where: { collectionId, savedItemId } });
  }
}
