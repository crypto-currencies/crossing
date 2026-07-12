import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { clientIpFromHeaders } from "@/lib/server/rate-limit";
import { getListingBySlug, incrementListingView, listRelatedListings } from "@/features/listings/data";
import { mapListingDetail, mapListingCard } from "@/features/listings/dto";
import { hasSaved } from "@/features/saves/data";
import { hasVoted } from "@/features/votes/data";
import { PageTransition } from "@/components/motion/page-transition";
import { SectionShell } from "@/components/layout/surface";
import { ListingLogo } from "@/components/listings/listing-logo";
import { CategoryIcon } from "@/components/listings/category-icon";
import { ListingGrid } from "@/components/listings/listing-grid";
import { SaveButton } from "@/components/listings/save-button";
import { VoteButton } from "@/components/listings/vote-button";

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  if (!DB_AVAILABLE) return { title: "Listing — Crossing.dev" };
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing || listing.status !== "PUBLISHED") return { title: "Listing — Crossing.dev" };
  return { title: `${listing.name} — Crossing.dev`, description: listing.tagline };
}

export default async function ListingPage({ params }: ListingPageProps) {
  if (!DB_AVAILABLE) notFound();

  const { slug } = await params;
  const listingRow = await getListingBySlug(slug);
  if (!listingRow || listingRow.status !== "PUBLISHED") notFound();

  const listing = mapListingDetail(listingRow);

  // Best-effort, never blocks the page render.
  incrementListingView(listingRow.id, clientIpFromHeaders(await headers())).catch(() => {});

  const [user, related] = await Promise.all([
    getServerUser(),
    listRelatedListings(listingRow.category.id, listingRow.id, 4),
  ]);

  const [saved, voted] = user
    ? await Promise.all([hasSaved(user.id, listingRow.id), hasVoted(user.id, listingRow.id)])
    : [false, false];

  const relatedItems = related.map(mapListingCard);

  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <div className="flex flex-col gap-[24px] sm:flex-row sm:items-start">
            <ListingLogo logoUrl={listing.logoUrl} name={listing.name} size="xl" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-[10px]">
                <h1 className="t-display-md">{listing.name}</h1>
                <span className="flex items-center gap-[4px] rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[3px] text-[10.5px] font-medium text-[var(--text-soft)]">
                  <BadgeCheck className="size-[11px] text-[var(--success)]" />
                  Reviewed listing
                </span>
              </div>
              <p className="mt-[6px] max-w-[560px] text-[14px] text-[var(--text-soft)]">{listing.tagline}</p>

              <div className="mt-[14px] flex flex-wrap items-center gap-[10px]">
                <Link
                  href={`/category/${listing.category.slug}`}
                  className="flex items-center gap-[5px] rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-[10px] py-[5px] text-[11.5px] font-medium text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  <CategoryIcon name={listing.category.icon} className="size-[11px]" />
                  {listing.category.name}
                </Link>
                <span className="text-[11.5px] text-[var(--muted)]">
                  Listed {relativeTime(listing.publishedAt)}
                </span>
              </div>

              <div className="mt-[20px] flex flex-wrap items-center gap-[10px]">
                <a
                  href={listing.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="button inline-flex h-[40px] items-center justify-center gap-[8px] rounded-[12px] !text-white bg-[#6d28d9] border border-[rgba(109,40,217,0.40)] px-[18px] text-[13px] font-medium hover:bg-[#7c3aed]"
                >
                  Visit website
                  <ArrowUpRight className="size-[14px]" />
                </a>
                <VoteButton
                  listingSlug={listing.slug}
                  listingName={listing.name}
                  initialVoted={voted}
                  initialCount={listing.voteCount}
                  variant="full"
                />
                <SaveButton
                  listingSlug={listing.slug}
                  listingName={listing.name}
                  initialSaved={saved}
                  initialCount={listing.saveCount}
                  variant="full"
                />
              </div>
              <p className="mt-[8px] text-[11px] text-[var(--muted)]">
                You&rsquo;ll leave Crossing.dev — {new URL(listing.websiteUrl).hostname.replace(/^www\./, "")} opens in a new tab.
              </p>
            </div>
          </div>
        </SectionShell>

        <SectionShell spacing="tight">
          <div className="card max-w-[760px] bg-[var(--panel)] border-[var(--border)] p-[24px]">
            <h2 className="t-heading mb-[12px]">About {listing.name}</h2>
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.75] text-[var(--text-soft)]">
              {listing.description}
            </p>
          </div>
        </SectionShell>

        {relatedItems.length > 0 && (
          <SectionShell spacing="tight" className="pb-[80px]">
            <h2 className="t-heading mb-[16px]">More in {listing.category.name}</h2>
            <ListingGrid listings={relatedItems} cols="cards" />
          </SectionShell>
        )}
      </div>
    </PageTransition>
  );
}
