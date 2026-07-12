import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PageParams } from "@/lib/server/pagination";
import { listingCardSelect, type ListingCard, type PagedResult } from "@/features/listings/data";

/**
 * Creates the Vote row and increments the cached counter in one transaction.
 * Idempotent: voting for an already-voted listing returns `alreadyVoted: true`
 * — the DB unique constraint on (userId, listingId) is the actual source of
 * truth, this just makes the duplicate case a normal response rather than a 500.
 */
export async function addVote(
  userId: string,
  listingId: string
): Promise<{ voted: boolean; alreadyVoted: boolean }> {
  try {
    await db.$transaction([
      db.vote.create({ data: { userId, listingId } }),
      db.listing.update({ where: { id: listingId }, data: { voteCount: { increment: 1 } } }),
    ]);
    return { voted: true, alreadyVoted: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { voted: true, alreadyVoted: true };
    }
    throw err;
  }
}

export async function removeVote(userId: string, listingId: string): Promise<{ removed: boolean }> {
  const existing = await db.vote.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  if (!existing) return { removed: false };

  await db.$transaction([
    db.vote.delete({ where: { id: existing.id } }),
    db.listing.update({ where: { id: listingId }, data: { voteCount: { decrement: 1 } } }),
  ]);
  return { removed: true };
}

export async function hasVoted(userId: string, listingId: string): Promise<boolean> {
  const existing = await db.vote.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Batch lookup for rendering a list of cards — one query instead of one
 * `hasVoted` call per card. Returns the subset of `listingIds` the user
 * has voted for.
 */
export async function getVotedListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db.vote.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

export async function listVotedListings(userId: string, page: PageParams): Promise<PagedResult<ListingCard>> {
  const where = { userId };
  const [votes, total] = await Promise.all([
    db.vote.findMany({
      where,
      select: { listing: { select: listingCardSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    db.vote.count({ where }),
  ]);
  return { items: votes.map((v) => v.listing), page: page.page, pageSize: page.pageSize, total };
}
