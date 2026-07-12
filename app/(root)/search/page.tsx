import type { Metadata } from "next";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { searchListings } from "@/features/listings/search";
import { mapListingCard } from "@/features/listings/dto";
import { listActiveCategories } from "@/features/categories/data";
import { mapCategory } from "@/features/categories/dto";
import { getSavedListingIds } from "@/features/saves/data";
import { getVotedListingIds } from "@/features/votes/data";
import { PageTransition } from "@/components/motion/page-transition";
import { SearchClient } from "@/components/search/search-client";

export const metadata: Metadata = { title: "Search — Crossing.dev" };

const PAGE_SIZE = 18;

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", category } = await searchParams;

  if (!DB_AVAILABLE) {
    return (
      <PageTransition>
        <SearchClient
          key={`${q}:${category ?? ""}`}
          initialQuery={q}
          initialCategory={category ?? ""}
          categories={[]}
          initialResult={{ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 }}
          initialSavedIds={[]}
          initialVotedIds={[]}
          dbUnavailable
        />
      </PageTransition>
    );
  }

  const page = { page: 1, pageSize: PAGE_SIZE, skip: 0, take: PAGE_SIZE };

  const [result, categories, user] = await Promise.all([
    searchListings({ q, categorySlug: category }, page),
    listActiveCategories(),
    getServerUser(),
  ]);

  const items = result.items.map(mapListingCard);
  const ids = items.map((l) => l.id);
  const [savedIds, votedIds] = user
    ? await Promise.all([getSavedListingIds(user.id, ids), getVotedListingIds(user.id, ids)])
    : [new Set<string>(), new Set<string>()];

  return (
    <PageTransition>
      <SearchClient
        key={`${q}:${category ?? ""}`}
        initialQuery={q}
        initialCategory={category ?? ""}
        categories={categories.map(mapCategory)}
        initialResult={{ ...result, items }}
        initialSavedIds={[...savedIds]}
        initialVotedIds={[...votedIds]}
      />
    </PageTransition>
  );
}
