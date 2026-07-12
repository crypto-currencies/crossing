"use client";

import { useState, useMemo } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { ListingGrid } from "@/components/listings/listing-grid";
import { CategoryIcon } from "@/components/listings/category-icon";
import { EmptyState } from "@/components/product/empty-state";
import type { ListingCard } from "@/types";

interface SavedClientProps {
  listings: ListingCard[];
  votedIds: string[];
}

export function SavedClient({ listings: initialListings, votedIds }: SavedClientProps) {
  const [listings, setListings] = useState(initialListings);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Map<string, ListingCard["category"]>();
    for (const l of listings) seen.set(l.category.slug, l.category);
    return [...seen.values()];
  }, [listings]);

  const filtered = categoryFilter ? listings.filter((l) => l.category.slug === categoryFilter) : listings;

  function handleSaveSettled(id: string, saved: boolean) {
    if (!saved) {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
  }

  return (
    <div className="page-stack">
      <SectionShell spacing="tight">
        <PageHeader title="Saved" description="Listings you've bookmarked for later." />
      </SectionShell>

      <SectionShell spacing="default" className="pb-[80px]">
        {listings.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Nothing saved yet"
            description="Save a listing from any page to keep track of it here."
            action={{ label: "Start exploring", href: "/" }}
          />
        ) : (
          <>
            {categories.length > 1 && (
              <div className="mb-[20px] flex flex-wrap gap-[8px]" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    "rounded-full border px-[12px] py-[6px] text-[12px] font-medium transition-colors",
                    !categoryFilter
                      ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
                  )}
                  aria-pressed={!categoryFilter}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCategoryFilter(c.slug)}
                    className={cn(
                      "flex items-center gap-[5px] rounded-full border px-[12px] py-[6px] text-[12px] font-medium transition-colors",
                      categoryFilter === c.slug
                        ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                        : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
                    )}
                    aria-pressed={categoryFilter === c.slug}
                  >
                    <CategoryIcon name={c.icon} className="size-[11px]" />
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <ListingGrid
              listings={filtered}
              savedIds={new Set(listings.map((l) => l.id))}
              votedIds={new Set(votedIds)}
              onSaveSettled={handleSaveSettled}
            />
          </>
        )}
      </SectionShell>
    </div>
  );
}
