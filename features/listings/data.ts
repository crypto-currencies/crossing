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
  popularThisWeek: ListingCard[];
  editorialPicks: ListingCard[];
  recentlyAdded: ListingCard[];
  hiddenGems: ListingCard[];
}

interface HomepageSectionLimits {
  trending?: number;
  popularThisWeek?: number;
  editorialPicks?: number;
  recentlyAdded?: number;
  hiddenGems?: number;
}

const POPULAR_WINDOW_DAYS = 7;

/**
 * Every homepage listing section, computed together so each is guaranteed
 * disjoint from the ones before it (excludes by id, not by relying on sort
 * ties never colliding) — the homepage must never show the same listing in
 * two differently-titled sections. Each section is a genuinely distinct
 * real signal, not a re-sort of the same underlying order:
 *
 * - trending:        highest rankingScore — the blended, decayed signal
 *                     category pages use.
 * - popularThisWeek: raw vote+save velocity in the last 7 days specifically
 *                     — distinct from `trending`, which blends recency into
 *                     one score alongside lifetime totals. This is "what's
 *                     getting attention *right now*," even if it hasn't
 *                     accumulated enough lifetime signal to rank overall.
 * - editorialPicks:  listings with a nonzero `editorialBoost` — the one
 *                     manually-curated signal in the schema (see
 *                     docs/ranking-v0.md). Genuinely empty until an admin
 *                     (or the seed script, for now) sets it on something.
 * - recentlyAdded:   newest by publishedAt.
 * - hiddenGems:      solid vote/save counts among whatever's left — "worth
 *                     checking out" listings that aren't currently on top.
 */
/**
 * Runs one homepage section query in isolation — if it fails (bad connection
 * blip, a single malformed row, whatever), that section degrades to empty
 * instead of taking the rest of the homepage down with it. The error is
 * logged server-side (never surfaced to the client) so it's still visible in
 * production logs.
 */
async function safeSection<T>(section: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[listHomepageSections] "${section}" query failed, degrading to empty:`, err);
    return [];
  }
}

export async function listHomepageSections(limits: HomepageSectionLimits = {}): Promise<HomepageSections> {
  const {
    trending: trendingLimit = 6,
    popularThisWeek: popularLimit = 5,
    editorialPicks: editorialLimit = 4,
    recentlyAdded: recentLimit = 6,
    hiddenGems: gemsLimit = 5,
  } = limits;

  const trending = await safeSection("trending", () =>
    db.listing.findMany({
      where: { status: "PUBLISHED" },
      select: listingCardSelect,
      orderBy: [{ rankingScore: "desc" }, { id: "desc" }],
      take: trendingLimit,
    })
  );
  const trendingIds = trending.map((l) => l.id);

  const popularThisWeek = await safeSection("popularThisWeek", () =>
    listPopularThisWeek(trendingIds, popularLimit)
  );
  const popularIds = popularThisWeek.map((l) => l.id);

  const editorialPicks = await safeSection("editorialPicks", () =>
    db.listing.findMany({
      where: {
        status: "PUBLISHED",
        editorialBoost: { gt: 0 },
        id: { notIn: [...trendingIds, ...popularIds] },
      },
      select: listingCardSelect,
      orderBy: [{ editorialBoost: "desc" }, { id: "desc" }],
      take: editorialLimit,
    })
  );
  const editorialIds = editorialPicks.map((l) => l.id);

  const recentlyAdded = await safeSection("recentlyAdded", () =>
    db.listing.findMany({
      where: { status: "PUBLISHED", id: { notIn: [...trendingIds, ...popularIds, ...editorialIds] } },
      select: listingCardSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: recentLimit,
    })
  );

  const excludeIds = [...trendingIds, ...popularIds, ...editorialIds, ...recentlyAdded.map((l) => l.id)];
  const hiddenGems = await safeSection("hiddenGems", () =>
    db.listing.findMany({
      where: { status: "PUBLISHED", id: { notIn: excludeIds } },
      select: listingCardSelect,
      orderBy: [{ voteCount: "desc" }, { saveCount: "desc" }, { id: "desc" }],
      take: gemsLimit,
    })
  );

  return { trending, popularThisWeek, editorialPicks, recentlyAdded, hiddenGems };
}

/**
 * Vote+save velocity within the last POPULAR_WINDOW_DAYS, ranked by count —
 * a windowed engagement signal, not a blended/decayed score. Two separate
 * groupBy aggregates (Vote and Save have no direct relation to join on)
 * merged in memory, then the top listings' full card data is fetched in one
 * query. Excludes `excludeIds` (already-shown trending listings) up front
 * so this never has to over-fetch to backfill after filtering.
 */
async function listPopularThisWeek(excludeIds: string[], limit: number): Promise<ListingCard[]> {
  const windowStart = new Date(Date.now() - POPULAR_WINDOW_DAYS * 86_400_000);

  const [recentVotes, recentSaves] = await Promise.all([
    db.vote.groupBy({
      by: ["listingId"],
      where: { createdAt: { gte: windowStart }, listingId: { notIn: excludeIds } },
      _count: { _all: true },
    }),
    db.save.groupBy({
      by: ["listingId"],
      where: { createdAt: { gte: windowStart }, listingId: { notIn: excludeIds } },
      _count: { _all: true },
    }),
  ]);

  const activity = new Map<string, number>();
  for (const row of recentVotes) activity.set(row.listingId, (activity.get(row.listingId) ?? 0) + row._count._all);
  for (const row of recentSaves) activity.set(row.listingId, (activity.get(row.listingId) ?? 0) + row._count._all);

  const topIds = [...activity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const listings = await db.listing.findMany({
    where: { status: "PUBLISHED", id: { in: topIds } },
    select: listingCardSelect,
  });

  // groupBy has no stable order guarantee — resort to match the computed ranking.
  const byId = new Map(listings.map((l) => [l.id, l]));
  return topIds.map((id) => byId.get(id)).filter((l): l is ListingCard => l != null);
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
