"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Grid2X2, List, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import type { Category, ListingCard } from "@/types";
import { CategoryContractCard, ListingResultCard, ProductEmptyState, ProductNotice } from "./product-primitives";

type PagedListings = {
  items: ListingCard[];
  page: number;
  pageSize: number;
  total: number;
};

type CatalogExplorerProps = {
  mode: "discover" | "browse";
  contractCategories: Array<{ id: string; name: string; description?: string | null }>;
  initialCategory?: string;
};

const STARTING_POINTS = [
  { label: "For a small team", query: "project management tool for a small team with a free plan" },
  { label: "For privacy", query: "privacy friendly analytics tool that can be self hosted" },
  { label: "For shipping", query: "simple hosting platform for a small web app" },
] as const;

export function CatalogExplorer({ mode, contractCategories, initialCategory = "" }: CatalogExplorerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<"trending" | "newest">("trending");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ sort, pageSize: "24" });
        if (category) params.set("category", category);
        const [categoryResponse, listingsResponse] = await Promise.all([
          fetch("/api/categories", { cache: "no-store" }),
          fetch(`/api/listings?${params}`, { cache: "no-store" }),
        ]);
        if (!categoryResponse.ok || !listingsResponse.ok) throw new Error("catalog_unavailable");
        const categoryData = (await categoryResponse.json()) as { categories?: Category[] };
        const listingData = (await listingsResponse.json()) as PagedListings;
        if (cancelled) return;
        setCategories(categoryData.categories ?? []);
        setItems(listingData.items ?? []);
        setTotal(listingData.total ?? 0);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [category, sort]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.name} ${item.tagline} ${item.category.name}`.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  const visibleCategories = categories.length ? categories : contractCategories;

  return (
    <div className="catalog-explorer">
      {mode === "discover" ? (
        <>
          <ProductNotice label="Live catalog">
            <p>
              Popularity and “trending” labels appear only when the listings endpoint returns catalog data.
              Guided prompts below are starting points, not activity claims.
            </p>
          </ProductNotice>

          <section className="product-section" aria-labelledby="starting-points-title">
            <div className="product-section-heading">
              <div>
                <p className="product-eyebrow">Guided starting points</p>
                <h2 id="starting-points-title">Start with what matters to you</h2>
              </div>
              <Link href="/search">
                Open search <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <div className="starting-point-grid">
              {STARTING_POINTS.map((point) => (
                <Link key={point.query} href={`/search?q=${encodeURIComponent(point.query)}`}>
                  <span>{point.label}</span>
                  <strong>{point.query}</strong>
                  <ArrowRight size={17} aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="product-section" aria-labelledby="category-contract-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">Supported category contract</p>
            <h2 id="category-contract-title">{mode === "discover" ? "Explore the catalog" : "Choose a category"}</h2>
          </div>
        </div>
        <div className="catalog-category-grid">
          {visibleCategories.map((item) => (
            <CategoryContractCard key={item.id} category={item} />
          ))}
        </div>
      </section>

      <section className="product-section" aria-labelledby="catalog-results-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">{sort === "newest" ? "Recently published" : "Catalog order"}</p>
            <h2 id="catalog-results-title">{category ? "Category results" : "Available listings"}</h2>
          </div>
          {state === "ready" && total > 0 ? <span className="catalog-result-count">{total} results</span> : null}
        </div>

        <div className="catalog-toolbar" aria-label="Catalog controls">
          <label className="catalog-search">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search within results</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search within results" />
          </label>
          <label>
            <SlidersHorizontal size={16} aria-hidden />
            <span className="sr-only">Category</span>
            <select value={category} onChange={(event) => { setState("loading"); setCategory(event.target.value); }}>
              <option value="">All categories</option>
              {visibleCategories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort order</span>
            <select value={sort} onChange={(event) => { setState("loading"); setSort(event.target.value as "trending" | "newest"); }}>
              <option value="trending">Catalog order</option>
              <option value="newest">Newest</option>
            </select>
          </label>
          <div className="catalog-view-toggle" role="group" aria-label="Result layout">
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view">
              <Grid2X2 size={16} />
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List view">
              <List size={17} />
            </button>
          </div>
        </div>

        {state === "loading" ? (
          <div className="catalog-loading" role="status">
            <LoaderCircle size={20} aria-hidden /> Loading catalog…
          </div>
        ) : state === "error" ? (
          <ProductEmptyState
            title="The catalog could not be reached"
            body="Search still works. Try the catalog again in a moment, or describe what you need directly."
            action={{ label: "Search Crossing", href: "/search" }}
          />
        ) : filtered.length ? (
          <div className={view === "grid" ? "catalog-results-grid" : "catalog-results-list"}>
            {filtered.map((listing) => (
              <ListingResultCard key={listing.id} listing={listing} compact={view === "list"} />
            ))}
          </div>
        ) : (
          <ProductEmptyState
            title={items.length ? "No results match that filter" : "No catalog listings are available yet"}
            body={
              items.length
                ? "Clear the search or choose another category."
                : "The interface is connected to the production catalog contract, but the endpoint returned no published listings."
            }
            action={{ label: "Search supported software", href: "/search?q=software%20tool" }}
          />
        )}
      </section>
    </div>
  );
}
