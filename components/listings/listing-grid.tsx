"use client";

import { Grid } from "@/components/layout/grid";
import { StaggerReveal } from "@/components/motion/reveal";
import { ListingCard } from "./listing-card";
import type { ListingCard as ListingCardType } from "@/types";

interface ListingGridProps {
  listings: ListingCardType[];
  trendingIds?: Set<string>;
  savedIds?: Set<string>;
  votedIds?: Set<string>;
  cols?: "browse" | "cards";
  onSaveSettled?: (id: string, saved: boolean) => void;
}

export function ListingGrid({
  listings,
  trendingIds,
  savedIds,
  votedIds,
  cols = "browse",
  onSaveSettled,
}: ListingGridProps) {
  return (
    <StaggerReveal staggerDelay={0.04}>
      <Grid cols={cols} gap="md">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            trending={trendingIds?.has(listing.id)}
            initialSaved={savedIds?.has(listing.id)}
            initialVoted={votedIds?.has(listing.id)}
            onSaveSettled={onSaveSettled ? (saved) => onSaveSettled(listing.id, saved) : undefined}
          />
        ))}
      </Grid>
    </StaggerReveal>
  );
}
