import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PageParams } from "@/lib/server/pagination";
import { listingCardSelect, type ListingCard, type PagedResult } from "@/features/listings/data";

/**
 * Creates the Save row and increments the cached counter in one transaction.
 * Idempotent: saving an already-saved listing returns `alreadySaved: true`
 * instead of throwing — the DB unique constraint on (userId, listingId) is
 * the actual source of truth, this just makes the duplicate case a normal
 * response rather than a 500.
 */
export async function saveListing(
  userId: string,
  listingId: string
): Promise<{ saved: boolean; alreadySaved: boolean }> {
  try {
    await db.$transaction([
      db.save.create({ data: { userId, listingId } }),
      db.listing.update({ where: { id: listingId }, data: { saveCount: { increment: 1 } } }),
    ]);
    return { saved: true, alreadySaved: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { saved: true, alreadySaved: true };
    }
    throw err;
  }
}

export async function unsaveListing(userId: string, listingId: string): Promise<{ removed: boolean }> {
  const existing = await db.save.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  if (!existing) return { removed: false };

  await db.$transaction([
    db.save.delete({ where: { id: existing.id } }),
    db.listing.update({ where: { id: listingId }, data: { saveCount: { decrement: 1 } } }),
  ]);
  return { removed: true };
}

export async function hasSaved(userId: string, listingId: string): Promise<boolean> {
  const existing = await db.save.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Batch lookup for rendering a list of cards — one query instead of one
 * `hasSaved` call per card. Returns the subset of `listingIds` the user
 * has saved.
 */
export async function getSavedListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db.save.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

export async function listSavedListings(userId: string, page: PageParams): Promise<PagedResult<ListingCard>> {
  const where = { userId };
  const [saves, total] = await Promise.all([
    db.save.findMany({
      where,
      select: { listing: { select: listingCardSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    db.save.count({ where }),
  ]);
  return { items: saves.map((s) => s.listing), page: page.page, pageSize: page.pageSize, total };
}
