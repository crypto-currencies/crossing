/**
 * Maps Prisma listing rows -> client-facing DTOs (types/index.ts).
 * Deliberately drops `rankingScore` — see the ListingCard type doc comment.
 */

import type { ListingCard as ListingCardRow, ListingDetail as ListingDetailRow } from "./data";
import type { ListingCard, ListingDetail } from "@/types";

export function mapListingCard(row: ListingCardRow): ListingCard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    websiteUrl: row.websiteUrl,
    publishedAt: row.publishedAt.toISOString(),
    saveCount: row.saveCount,
    voteCount: row.voteCount,
    category: row.category,
  };
}

export function mapListingDetail(row: ListingDetailRow): ListingDetail {
  return {
    ...mapListingCard(row),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    submittedBy: row.submittedBy,
  };
}
