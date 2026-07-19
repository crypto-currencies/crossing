/**
 * Maps Prisma listing rows -> client-facing DTOs (types/index.ts).
 * Deliberately drops `rankingScore` — see the ListingCard type doc comment.
 */

import type { ListingCard as ListingCardRow, ListingDetail as ListingDetailRow } from "./data";
import type { ListingCard, ListingDetail } from "@/types";

function listingLogoUrl(logoUrl: string | null, websiteUrl: string): string | null {
  if (logoUrl) return logoUrl;

  try {
    const site = new URL(websiteUrl);
    const domainUrl = encodeURIComponent(`${site.protocol}//${site.hostname}`);
    return `https://www.google.com/s2/favicons?domain_url=${domainUrl}&sz=128`;
  } catch {
    return null;
  }
}

export function mapListingCard(row: ListingCardRow): ListingCard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    logoUrl: listingLogoUrl(row.logoUrl, row.websiteUrl),
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
