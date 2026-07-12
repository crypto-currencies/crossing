/**
 * Search v0 — plain Postgres `ILIKE`-style substring matching via Prisma's
 * `contains` + `mode: "insensitive"`. No external search provider.
 *
 * The public shape here (`SearchParams` in, `PagedResult<ListingCard>` out)
 * is deliberately identical to the other listing list functions in
 * features/listings/data.ts. Swapping the WHERE-clause internals for
 * PostgreSQL full-text search (`tsvector` + `websearch_to_tsquery`) or a
 * hosted search service later is a change confined to this file — callers
 * (routes, UI) don't need to change.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PageParams } from "@/lib/server/pagination";
import { listingCardSelect, type ListingCard, type PagedResult } from "./data";

const MAX_QUERY_LENGTH = 200;

export interface SearchParams {
  q: string;
  categorySlug?: string;
}

export async function searchListings(
  params: SearchParams,
  page: PageParams
): Promise<PagedResult<ListingCard>> {
  const q = params.q.trim().slice(0, MAX_QUERY_LENGTH);

  const where: Prisma.ListingWhereInput = {
    status: "PUBLISHED",
    ...(params.categorySlug ? { category: { slug: params.categorySlug } } : {}),
    // Empty query → fall through to the general published/category feed
    // instead of an empty result set or a `contains: ""` no-op filter.
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Stable ordering: rankingScore ties (common for new/unranked listings)
  // are broken by id so identical pages don't reshuffle between requests.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = [
    { rankingScore: "desc" },
    { id: "desc" },
  ];

  const [items, total] = await Promise.all([
    db.listing.findMany({ where, select: listingCardSelect, orderBy, skip: page.skip, take: page.take }),
    db.listing.count({ where }),
  ]);

  return { items, page: page.page, pageSize: page.pageSize, total };
}
