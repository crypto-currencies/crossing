import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { getCategoryBySlug } from "@/features/categories/data";
import { listListingsByCategory } from "@/features/listings/data";
import { mapListingCard } from "@/features/listings/dto";
import { getSavedListingIds } from "@/features/saves/data";
import { getVotedListingIds } from "@/features/votes/data";
import { PageTransition } from "@/components/motion/page-transition";
import { SectionShell } from "@/components/layout/surface";
import { CategoryIcon } from "@/components/listings/category-icon";
import { ListingGrid } from "@/components/listings/listing-grid";
import { EmptyState } from "@/components/product/empty-state";
import { Inbox } from "lucide-react";

const PAGE_SIZE = 24;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  if (!DB_AVAILABLE) return { title: "Category — Crossing.dev" };
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: category ? `${category.name} — Crossing.dev` : "Category — Crossing.dev" };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  if (!DB_AVAILABLE) notFound();

  const { slug } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) notFound();

  const sort = rawSort === "newest" ? "newest" : "trending";
  const pageNum = Math.max(1, Number(rawPage) || 1);
  const page = { page: pageNum, pageSize: PAGE_SIZE, skip: (pageNum - 1) * PAGE_SIZE, take: PAGE_SIZE };

  const [result, user] = await Promise.all([
    listListingsByCategory(slug, page, sort),
    getServerUser(),
  ]);

  const items = result.items.map(mapListingCard);
  const ids = items.map((l) => l.id);
  const [savedIds, votedIds] = user
    ? await Promise.all([getSavedListingIds(user.id, ids), getVotedListingIds(user.id, ids)])
    : [new Set<string>(), new Set<string>()];

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <div className="flex items-start gap-[16px]">
            <span className="flex size-[48px] flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)]">
              <CategoryIcon name={category.icon} className="size-[20px] text-[var(--text-soft)]" />
            </span>
            <div className="min-w-0">
              <h1 className="t-display-md">{category.name}</h1>
              {category.description && (
                <p className="mt-[6px] max-w-[560px] t-body-sm text-[var(--text-soft)]">{category.description}</p>
              )}
            </div>
          </div>

          {/* Sort toggle — plain links, no client JS needed */}
          <div className="mt-[20px] flex gap-[8px]" role="group" aria-label="Sort listings">
            <Link
              href={`/category/${slug}`}
              className={cn(
                "rounded-full border px-[14px] py-[7px] text-[12.5px] font-medium transition-colors",
                sort === "trending"
                  ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
              )}
              aria-current={sort === "trending" ? "true" : undefined}
            >
              Trending
            </Link>
            <Link
              href={`/category/${slug}?sort=newest`}
              className={cn(
                "rounded-full border px-[14px] py-[7px] text-[12.5px] font-medium transition-colors",
                sort === "newest"
                  ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--text-soft)] hover:border-[var(--border-strong)]"
              )}
              aria-current={sort === "newest" ? "true" : undefined}
            >
              Newest
            </Link>
          </div>
        </SectionShell>

        <SectionShell spacing="default">
          {items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nothing here yet"
              description={`No listings in ${category.name} yet — check back soon, or submit one yourself.`}
              action={{ label: "Submit a listing", href: "/submit" }}
            />
          ) : (
            <>
              <p className="mb-[16px] text-[12px] text-[var(--muted)]">
                {result.total.toLocaleString()} listing{result.total === 1 ? "" : "s"}
              </p>
              <ListingGrid listings={items} savedIds={savedIds} votedIds={votedIds} />

              {totalPages > 1 && (
                <nav className="mt-[28px] flex items-center justify-center gap-[8px]" aria-label="Pagination">
                  <Link
                    href={`/category/${slug}?${new URLSearchParams({ ...(sort === "newest" ? { sort } : {}), page: String(pageNum - 1) })}`}
                    aria-disabled={pageNum <= 1}
                    className={cn(
                      "flex items-center gap-[4px] rounded-[var(--radius-md)] border border-[var(--border)] px-[12px] py-[7px] text-[12.5px] text-[var(--text-soft)] hover:border-[var(--border-strong)]",
                      pageNum <= 1 && "pointer-events-none opacity-30"
                    )}
                  >
                    <ChevronLeft className="size-[13px]" />
                    Previous
                  </Link>
                  <span className="text-[12px] text-[var(--muted)]">
                    Page {pageNum} of {totalPages}
                  </span>
                  <Link
                    href={`/category/${slug}?${new URLSearchParams({ ...(sort === "newest" ? { sort } : {}), page: String(pageNum + 1) })}`}
                    aria-disabled={pageNum >= totalPages}
                    className={cn(
                      "flex items-center gap-[4px] rounded-[var(--radius-md)] border border-[var(--border)] px-[12px] py-[7px] text-[12.5px] text-[var(--text-soft)] hover:border-[var(--border-strong)]",
                      pageNum >= totalPages && "pointer-events-none opacity-30"
                    )}
                  >
                    Next
                    <ChevronRight className="size-[13px]" />
                  </Link>
                </nav>
              )}
            </>
          )}
        </SectionShell>
      </div>
    </PageTransition>
  );
}
