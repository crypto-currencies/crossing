"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { cn, relativeTime, truncate } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import { ListingLogo } from "./listing-logo";
import { CategoryIcon } from "./category-icon";
import { SaveButton } from "./save-button";
import { VoteButton } from "./vote-button";
import type { ListingCard as ListingCardType } from "@/types";

interface ListingCardProps {
  listing: ListingCardType;
  variant?: "grid" | "compact";
  trending?: boolean;
  initialSaved?: boolean;
  initialVoted?: boolean;
  className?: string;
  /** Called after a successful save/unsave — e.g. a "my saved" list drops the card once unsaved. */
  onSaveSettled?: (saved: boolean) => void;
}

/**
 * The one canonical listing card. `grid` is the default (homepage
 * carousels, category grid, search results); `compact` drops the
 * description-length tagline clamp and footer spacing for dense contexts
 * like "related listings."
 */
export function ListingCard({
  listing,
  variant = "grid",
  trending = false,
  initialSaved = false,
  initialVoted = false,
  className,
  onSaveSettled,
}: ListingCardProps) {
  const compact = variant === "compact";

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.12 }}
      className={cn(
        "card hover-lift group relative flex flex-col bg-[var(--panel)] border-[var(--border)]",
        compact ? "p-[14px] gap-[10px]" : "p-[18px] gap-[14px]",
        className
      )}
    >
      {trending && (
        <span className="absolute right-[14px] top-[14px] flex items-center gap-[4px] rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)] px-[8px] py-[3px] text-[10px] font-medium text-[var(--accent-text)]">
          <TrendingUp className="size-[10px]" />
          Trending
        </span>
      )}

      <Link href={`/listing/${listing.slug}`} className="flex flex-1 flex-col gap-[14px] min-w-0">
        <div className="flex items-start gap-[12px] min-w-0">
          <ListingLogo logoUrl={listing.logoUrl} name={listing.name} size={compact ? "sm" : "md"} />
          <div className="min-w-0 flex-1 pt-[1px]">
            <h3
              className={cn(
                "font-semibold text-[var(--text)] truncate transition-colors group-hover:text-white",
                compact ? "text-[13px]" : "text-[14px]"
              )}
            >
              {listing.name}
            </h3>
            <p
              className={cn(
                "mt-[3px] text-[var(--text-soft)] leading-[1.5]",
                compact ? "text-[11.5px] line-clamp-1" : "text-[12.5px] line-clamp-2"
              )}
            >
              {truncate(listing.tagline, compact ? 60 : 100)}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-[10px] min-w-0">
        <Link
          href={`/category/${listing.category.slug}`}
          className="flex min-w-0 items-center gap-[5px] rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[3px] text-[10.5px] font-medium text-[var(--text-soft)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
        >
          <CategoryIcon name={listing.category.icon} className="size-[10px] flex-shrink-0" />
          <span className="truncate">{listing.category.name}</span>
        </Link>

        {!compact && (
          <div className="flex flex-shrink-0 items-center gap-[6px]">
            <VoteButton
              listingSlug={listing.slug}
              listingName={listing.name}
              initialVoted={initialVoted}
              initialCount={listing.voteCount}
              variant="icon"
            />
            <SaveButton
              listingSlug={listing.slug}
              listingName={listing.name}
              initialSaved={initialSaved}
              initialCount={listing.saveCount}
              variant="icon"
              onSettled={onSaveSettled}
            />
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-[10.5px] text-[var(--muted)]">Added {relativeTime(listing.publishedAt)}</p>
      )}
    </motion.div>
  );
}
