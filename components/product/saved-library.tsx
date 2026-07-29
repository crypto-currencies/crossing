"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, LoaderCircle, Search } from "lucide-react";
import type { ListingCard } from "@/types";
import { useAuthStore } from "@/store/auth";
import { ListingResultCard, ProductEmptyState, ProductNotice } from "./product-primitives";

type SavedResponse = {
  items: ListingCard[];
  total: number;
};

export function SavedLibrary() {
  const session = useAuthStore((state) => state.session);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [items, setItems] = useState<ListingCard[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name">("newest");

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/me/saves?pageSize=100", {
          cache: "no-store",
          ...(session?.token ? { headers: { authorization: `Bearer ${session.token}` } } : {}),
        });
        if (!response.ok) throw new Error("saved_unavailable");
        const data = (await response.json()) as SavedResponse;
        if (!cancelled) {
          setItems(data.items ?? []);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoadingAuth, session?.token]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const next = normalized
      ? items.filter((item) => `${item.name} ${item.tagline} ${item.category.name}`.toLowerCase().includes(normalized))
      : [...items];
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  }, [items, query, sort]);

  if (isLoadingAuth) {
    return (
      <div className="catalog-loading" role="status">
        <LoaderCircle size={20} aria-hidden /> Checking your account…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ProductEmptyState
        title="Log in to see your saved results"
        body="Saved items belong to your account. Crossing will bring you back here after you log in."
        action={{ label: "Log in", href: "/login?redirect=/saved" }}
        icon={<Bookmark size={24} />}
      />
    );
  }

  return (
    <div className="saved-library">
      <ProductNotice label="Collections">
        <p>
          Collection creation, notes, and tags do not have a persistence contract yet. Your confirmed saved
          listings appear below; Crossing does not simulate collections locally.
        </p>
        <button type="button" disabled aria-disabled="true">New collection — unavailable</button>
      </ProductNotice>

      {state === "loading" || state === "idle" ? (
        <div className="catalog-loading" role="status">
          <LoaderCircle size={20} aria-hidden /> Loading saved results…
        </div>
      ) : state === "error" ? (
        <ProductEmptyState
          title="Saved results could not be loaded"
          body="Your account is still signed in. Refresh this page to try the saved-items endpoint again."
          action={{ label: "Explore recommendations", href: "/discover" }}
        />
      ) : items.length === 0 ? (
        <ProductEmptyState
          title="Your shortlist starts with a search"
          body="You have no confirmed saved listings yet. Explore the live catalog or search for a recommendation."
          action={{ label: "Start discovering", href: "/discover" }}
          icon={<Bookmark size={24} />}
        />
      ) : (
        <>
          <div className="catalog-toolbar">
            <label className="catalog-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Filter saved results</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter saved results" />
            </label>
            <label>
              <span className="sr-only">Sort saved results</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "name")}>
                <option value="newest">Recently saved</option>
                <option value="name">Name</option>
              </select>
            </label>
            <span className="catalog-result-count">{visibleItems.length} saved</span>
          </div>
          {visibleItems.length ? (
            <div className="catalog-results-grid">
              {visibleItems.map((listing) => <ListingResultCard key={listing.id} listing={listing} />)}
            </div>
          ) : (
            <ProductEmptyState
              title="Nothing in your saves matches"
              body="Try a shorter search or change the sort order."
            />
          )}
        </>
      )}

      <p className="saved-library-footnote">
        Looking for something new? <Link href="/search">Search Crossing</Link>.
      </p>
    </div>
  );
}
