"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, SearchX, ServerCrash, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { listingsService, type PagedResult } from "@/lib/services/listings.service";
import { ListingGrid } from "@/components/listings/listing-grid";
import { CategoryIcon } from "@/components/listings/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/product/empty-state";
import type { ListingCard, CategorySummary } from "@/types";

const DEBOUNCE_MS = 350;

interface SearchClientProps {
  initialQuery: string;
  initialCategory: string;
  categories: CategorySummary[];
  initialResult: PagedResult<ListingCard>;
  initialSavedIds: string[];
  initialVotedIds: string[];
  dbUnavailable?: boolean;
}

export function SearchClient({
  initialQuery,
  initialCategory,
  categories,
  initialResult,
  initialSavedIds,
  initialVotedIds,
  dbUnavailable = false,
}: SearchClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const mounted = useRef(false);

  const [items, setItems] = useState<ListingCard[]>(initialResult.items);
  const [total, setTotal] = useState(initialResult.total);
  const [page, setPage] = useState(initialResult.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const savedIds = new Set(initialSavedIds);
  const votedIds = new Set(initialVotedIds);

  // ── Debounced URL sync for the text query ──────────────────────────────────
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (initialCategory) params.set("category", initialCategory);
      startTransition(() => {
        router.replace(`/search${params.toString() ? `?${params.toString()}` : ""}`);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function selectCategory(slug: string) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (slug) params.set("category", slug);
    startTransition(() => {
      router.replace(`/search${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setLoadError(null);
    const next = await listingsService.search({
      q: query,
      category: initialCategory || undefined,
      page: page + 1,
      pageSize: initialResult.pageSize,
    });
    if (!next) {
      setLoadError("Couldn't load more results. Try again.");
    } else {
      setItems((prev) => [...prev, ...next.items]);
      setPage(next.page);
      setTotal(next.total);
    }
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const hasMore = items.length < total;

  return (
    <div className="page-stack">
      <section className="stack-md">
        <h1 className="t-display-md">Search</h1>

        {/* Search input */}
        <div className="relative max-w-[520px]">
          <Search className="pointer-events-none absolute left-[14px] top-1/2 size-[15px] -translate-y-1/2 text-[var(--muted)]" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, software, communities…"
            aria-label="Search listings"
            autoFocus
            className="input h-[44px] w-full pl-[40px] pr-[36px] text-[13.5px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-[10px] top-1/2 flex size-[22px] -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text-soft)]"
            >
              <X className="size-[13px]" />
            </button>
          )}
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Filter by category">
            <button
              type="button"
              onClick={() => selectCategory("")}
              className={cn(
                "flex items-center gap-[5px] rounded-full border px-[12px] py-[6px] text-[12px] font-medium transition-colors",
                !initialCategory
                  ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
              )}
              aria-pressed={!initialCategory}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCategory(c.slug)}
                className={cn(
                  "flex items-center gap-[5px] rounded-full border px-[12px] py-[6px] text-[12px] font-medium transition-colors",
                  initialCategory === c.slug
                    ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                    : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
                )}
                aria-pressed={initialCategory === c.slug}
              >
                <CategoryIcon name={c.icon} className="size-[11px]" />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <section aria-live="polite" aria-busy={isPending}>
        {dbUnavailable ? (
          <EmptyState
            icon={ServerCrash}
            title="Search is temporarily unavailable"
            description="We're having trouble reaching the database. Try again shortly."
          />
        ) : isPending ? (
          <ResultsSkeleton />
        ) : items.length === 0 ? (
          query.trim() ? (
            <EmptyState
              icon={SearchX}
              title={`No results for "${query.trim()}"`}
              description="Try a different search term, or browse by category instead."
              action={{ label: "Browse categories", href: "/" }}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No listings yet"
              description="Nothing's been published in this category yet — check back soon."
              action={{ label: "Back to discovery", href: "/" }}
            />
          )
        ) : (
          <>
            <p className="mb-[16px] text-[12px] text-[var(--muted)]">
              {total.toLocaleString()} result{total === 1 ? "" : "s"}
            </p>
            <ListingGrid listings={items} savedIds={savedIds} votedIds={votedIds} />

            {loadError && (
              <p className="mt-[16px] text-center text-[12.5px] text-[var(--danger)]">{loadError}</p>
            )}

            {hasMore && (
              <div className="mt-[28px] flex justify-center">
                <Button variant="secondary" size="md" onClick={loadMore} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[var(--card-gap)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-[18px] stack-md">
          <div className="flex items-center gap-[12px]">
            <Skeleton className="size-11 flex-shrink-0" rounded="md" />
            <div className="flex-1 stack-sm">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="h-6 w-24" rounded="full" />
        </div>
      ))}
    </div>
  );
}
