"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, ExternalLink, LoaderCircle } from "lucide-react";
import type { ListingDetail as Listing } from "@/types";
import { useAuthStore } from "@/store/auth";
import { ProductEmptyState, ProductNotice } from "./product-primitives";

type ListingPayload = {
  listing: Listing;
  savedByCurrentUser: boolean;
};

export function ListingDetail({ slug }: { slug: string }) {
  const session = useAuthStore((state) => state.session);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [payload, setPayload] = useState<ListingPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/listings/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          ...(session?.token ? { headers: { authorization: `Bearer ${session.token}` } } : {}),
        });
        if (response.status === 404) {
          if (!cancelled) setState("not-found");
          return;
        }
        if (!response.ok) throw new Error("listing_unavailable");
        const next = (await response.json()) as ListingPayload;
        if (!cancelled) {
          setPayload(next);
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
  }, [session?.token, slug]);

  async function toggleSave() {
    if (!payload || saveState === "saving") return;
    if (!isAuthenticated) return;
    setSaveState("saving");
    const nextSaved = !payload.savedByCurrentUser;
    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(slug)}/save`, {
        method: nextSaved ? "POST" : "DELETE",
        ...(session?.token ? { headers: { authorization: `Bearer ${session.token}` } } : {}),
      });
      if (!response.ok) throw new Error("save_failed");
      setPayload((current) => current ? { ...current, savedByCurrentUser: nextSaved } : current);
      setSaveState("idle");
    } catch {
      setSaveState("error");
    }
  }

  if (state === "loading") return <div className="catalog-loading" role="status"><LoaderCircle size={20} aria-hidden /> Loading listing…</div>;
  if (state === "not-found") return <ProductEmptyState title="This listing is not available" body="It may have been removed, unpublished, or the link may be out of date." action={{ label: "Browse active listings", href: "/browse" }} />;
  if (state === "error" || !payload) return <ProductEmptyState title="The listing could not be reached" body="Try again shortly or return to the catalog." action={{ label: "Browse catalog", href: "/browse" }} />;

  const listing = payload.listing;
  return (
    <article className="listing-detail">
      <Link className="journal-back" href={`/browse/${listing.category.slug}`}><ArrowLeft size={15} aria-hidden /> {listing.category.name}</Link>
      <div className="listing-detail-hero">
        <div className="catalog-listing-mark" aria-hidden>
          {listing.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={listing.logoUrl} alt="" />
            : listing.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="product-eyebrow">{listing.category.name}</p>
          <h1>{listing.name}</h1>
          <p>{listing.tagline}</p>
        </div>
        <div className="listing-detail-actions">
          <a href={listing.websiteUrl} target="_blank" rel="noreferrer">Visit website <ExternalLink size={15} aria-hidden /></a>
          {isAuthenticated ? (
            <button type="button" onClick={toggleSave} disabled={saveState === "saving"} aria-pressed={payload.savedByCurrentUser}>
              <Bookmark size={15} fill={payload.savedByCurrentUser ? "currentColor" : "none"} aria-hidden />
              {saveState === "saving" ? "Saving…" : payload.savedByCurrentUser ? "Saved" : "Save"}
            </button>
          ) : (
            <Link href={`/login?redirect=${encodeURIComponent(`/listing/${slug}`)}`}>Log in to save</Link>
          )}
        </div>
      </div>

      {saveState === "error" ? <ProductNotice tone="error" label="Save not confirmed"><p>The server did not confirm that change, so the visible saved state was left unchanged.</p></ProductNotice> : null}

      <div className="listing-detail-grid">
        <section>
          <p className="product-eyebrow">About this listing</p>
          <h2>What it does</h2>
          <p>{listing.description}</p>
        </section>
        <aside>
          <dl>
            <div><dt>Published</dt><dd>{new Date(listing.publishedAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</dd></div>
            <div><dt>Category</dt><dd>{listing.category.name}</dd></div>
            <div><dt>Community signals</dt><dd>{listing.voteCount} votes · {listing.saveCount} saves</dd></div>
          </dl>
          <ProductNotice label="Catalog detail">
            <p>This page describes the saved listing. Search-specific reasons and source limits appear with recommendations rather than being invented here.</p>
          </ProductNotice>
        </aside>
      </div>
    </article>
  );
}
