import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { slugify, uniqueSlug } from "@/lib/server/slug";
import type { PageParams } from "@/lib/server/pagination";

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ─── Shared shapes ──────────────────────────────────────────────────────────

export const listingCardSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  logoUrl: true,
  coverImageUrl: true,
  websiteUrl: true,
  publishedAt: true,
  saveCount: true,
  voteCount: true,
  viewCount: true,
  rankingScore: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
} satisfies Prisma.ListingSelect;

export type ListingCard = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;

const listingDetailSelect = {
  ...listingCardSelect,
  description: true,
  status: true,
  createdAt: true,
  submittedBy: { select: { id: true, name: true, image: true } },
} satisfies Prisma.ListingSelect;

export type ListingDetail = Prisma.ListingGetPayload<{ select: typeof listingDetailSelect }>;

async function paged<T>(
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
  page: PageParams
): Promise<PagedResult<T>> {
  const [items, total] = await Promise.all([
    findMany({ skip: page.skip, take: page.take }),
    count(),
  ]);
  return { items, page: page.page, pageSize: page.pageSize, total };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getListingBySlug(slug: string): Promise<ListingDetail | null> {
  return db.listing.findUnique({ where: { slug }, select: listingDetailSelect });
}

export async function listPublishedListings(page: PageParams): Promise<PagedResult<ListingCard>> {
  const where: Prisma.ListingWhereInput = { status: "PUBLISHED" };
  return paged(
    (args) =>
      db.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        ...args,
      }),
    () => db.listing.count({ where }),
    page
  );
}

export async function listListingsByCategory(
  categorySlug: string,
  page: PageParams,
  sort: "trending" | "newest" = "trending"
): Promise<PagedResult<ListingCard>> {
  const where: Prisma.ListingWhereInput = {
    status: "PUBLISHED",
    category: { slug: categorySlug },
  };
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    sort === "newest" ? [{ publishedAt: "desc" }, { id: "desc" }] : [{ rankingScore: "desc" }, { id: "desc" }];
  return paged(
    (args) =>
      db.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy,
        ...args,
      }),
    () => db.listing.count({ where }),
    page
  );
}

export async function listTrendingListings(page: PageParams): Promise<PagedResult<ListingCard>> {
  const where: Prisma.ListingWhereInput = { status: "PUBLISHED" };
  return paged(
    (args) =>
      db.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy: [{ rankingScore: "desc" }, { id: "desc" }],
        ...args,
      }),
    () => db.listing.count({ where }),
    page
  );
}

export async function listNewestListings(page: PageParams): Promise<PagedResult<ListingCard>> {
  const where: Prisma.ListingWhereInput = { status: "PUBLISHED" };
  return paged(
    (args) =>
      db.listing.findMany({
        where,
        select: listingCardSelect,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        ...args,
      }),
    () => db.listing.count({ where }),
    page
  );
}

export interface HomepageSections {
  trending: ListingCard[];
  recentlyAdded: ListingCard[];
  hiddenGems: ListingCard[];
}

/**
 * The three homepage listing carousels, computed together so each is
 * guaranteed disjoint from the ones before it (excludes by id, not by
 * relying on sort ties never colliding) — the homepage must never show the
 * same listing in two differently-titled sections.
 *
 * - trending:      highest rankingScore (the same signal category pages use)
 * - recentlyAdded: newest by publishedAt, excluding anything already shown
 * - hiddenGems:    solid vote/save counts, excluding both lists above —
 *                  "worth checking out" listings that aren't currently on top
 */
export async function listHomepageSections(limit = 6): Promise<HomepageSections> {
  const trending = await db.listing.findMany({
    where: { status: "PUBLISHED" },
    select: listingCardSelect,
    orderBy: [{ rankingScore: "desc" }, { id: "desc" }],
    take: limit,
  });
  const trendingIds = trending.map((l) => l.id);

  const recentlyAdded = await db.listing.findMany({
    where: { status: "PUBLISHED", id: { notIn: trendingIds } },
    select: listingCardSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  const excludeIds = [...trendingIds, ...recentlyAdded.map((l) => l.id)];
  const hiddenGems = await db.listing.findMany({
    where: { status: "PUBLISHED", id: { notIn: excludeIds } },
    select: listingCardSelect,
    orderBy: [{ voteCount: "desc" }, { saveCount: "desc" }, { id: "desc" }],
    take: limit,
  });

  return { trending, recentlyAdded, hiddenGems };
}

/** Other published listings in the same category — for a listing's detail page. */
export async function listRelatedListings(
  categoryId: string,
  excludeListingId: string,
  limit = 4
): Promise<ListingCard[]> {
  return db.listing.findMany({
    where: { status: "PUBLISHED", categoryId, id: { not: excludeListingId } },
    select: listingCardSelect,
    orderBy: [{ rankingScore: "desc" }, { id: "desc" }],
    take: limit,
  });
}

// ─── View counting ──────────────────────────────────────────────────────────

/**
 * Atomically increments viewCount, rate-limited per (IP, listing) so a
 * refresh-spam or bot loop can't inflate it. Fails open (still counts the
 * view) if Upstash isn't configured, matching this codebase's rate-limit
 * convention — "safely" here means atomic + budgeted, not "never wrong."
 */
export async function incrementListingView(listingId: string, clientIp: string): Promise<void> {
  const allowed = await rateLimit(`listing-view:${listingId}:${clientIp}`, 1, 60_000);
  if (!allowed) return;
  await db.listing.update({
    where: { id: listingId },
    data: { viewCount: { increment: 1 } },
  });
}

// ─── Internal: used by the submission-approval flow ────────────────────────

/**
 * Creates a PUBLISHED Listing from an approved Submission, inside the same
 * transaction as the Submission status update. Not exposed outside the
 * discovery domain — see features/submissions/data.ts#approveSubmission.
 */
export async function createListingFromSubmission(
  tx: Prisma.TransactionClient,
  input: {
    name: string;
    tagline: string;
    description: string;
    websiteUrl: string;
    websiteUrlKey: string;
    categoryId: string;
    submittedById: string;
    approvedById: string;
  }
) {
  const base = slugify(input.name);
  const slug = await uniqueSlug(base, async (candidate) => {
    const existing = await tx.listing.findUnique({ where: { slug: candidate }, select: { id: true } });
    return existing !== null;
  });

  return tx.listing.create({
    data: {
      name: input.name,
      slug,
      tagline: input.tagline,
      description: input.description,
      websiteUrl: input.websiteUrl,
      websiteUrlKey: input.websiteUrlKey,
      categoryId: input.categoryId,
      submittedById: input.submittedById,
      approvedById: input.approvedById,
      approvedAt: new Date(),
      status: "PUBLISHED",
    },
  });
}
