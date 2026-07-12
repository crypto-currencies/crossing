import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Flame, Clock, Gem } from "lucide-react";
import { DB_AVAILABLE } from "@/lib/db";
import { getServerUser } from "@/lib/server/auth";
import { listActiveCategories } from "@/features/categories/data";
import { mapCategory } from "@/features/categories/dto";
import { listHomepageSections } from "@/features/listings/data";
import { mapListingCard } from "@/features/listings/dto";
import { getSavedListingIds } from "@/features/saves/data";
import { getVotedListingIds } from "@/features/votes/data";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { SectionShell, SectionHeader } from "@/components/layout/surface";
import { HeroSearch } from "@/components/home/hero-search";
import { ListingGrid } from "@/components/listings/listing-grid";
import { CategoryTile } from "@/components/listings/category-tile";
import { Grid } from "@/components/layout/grid";

export const metadata: Metadata = { title: "Crossing.dev — What's worth your time?" };

export default async function HomePage() {
  if (!DB_AVAILABLE) {
    return <HomeUnavailable />;
  }

  const [categories, sections, user] = await Promise.all([
    listActiveCategories(),
    listHomepageSections(6),
    getServerUser(),
  ]);

  const allIds = [
    ...sections.trending,
    ...sections.recentlyAdded,
    ...sections.hiddenGems,
  ].map((l) => l.id);

  const [savedIds, votedIds] = user
    ? await Promise.all([getSavedListingIds(user.id, allIds), getVotedListingIds(user.id, allIds)])
    : [new Set<string>(), new Set<string>()];

  const trending = sections.trending.map(mapListingCard);
  const recentlyAdded = sections.recentlyAdded.map(mapListingCard);
  const hiddenGems = sections.hiddenGems.map(mapListingCard);
  const trendingIds = new Set(trending.map((l) => l.id));

  return (
    <PageTransition>
      <div className="page-stack">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          className="relative flex flex-col items-center justify-center px-[var(--page-gutter)] text-center"
          style={{ minHeight: "calc(72svh - var(--topbar-height))" }}
        >
          <h1
            className="mb-[16px]"
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            What&rsquo;s worth your time?
          </h1>
          <p className="mb-[32px] max-w-[480px] text-[14px] leading-[1.7] text-[var(--text-soft)]">
            Software, tools, and communities worth checking out — submitted by people,
            reviewed before they go live.
          </p>
          <HeroSearch />
        </section>

        {/* ── Trending ─────────────────────────────────────────────────────── */}
        {trending.length > 0 && (
          <Reveal>
            <SectionShell spacing="tight">
              <SectionHeader
                eyebrow="Right now"
                title="Trending"
                description="What people are recommending and saving most this week."
                action={
                  <Link
                    href="/search?sort=trending"
                    className="flex items-center gap-[4px] text-[12.5px] font-medium text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
                  >
                    <Flame className="size-[13px]" />
                    See all
                  </Link>
                }
              />
              <div className="mt-[20px]">
                <ListingGrid listings={trending} savedIds={savedIds} votedIds={votedIds} />
              </div>
            </SectionShell>
          </Reveal>
        )}

        {/* ── Recently added ──────────────────────────────────────────────── */}
        {recentlyAdded.length > 0 && (
          <Reveal>
            <SectionShell spacing="tight">
              <SectionHeader
                eyebrow="Freshly listed"
                title="Recently added"
                description="The newest listings, approved and live."
                action={
                  <Link
                    href="/search?sort=newest"
                    className="flex items-center gap-[4px] text-[12.5px] font-medium text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
                  >
                    <Clock className="size-[13px]" />
                    See all
                  </Link>
                }
              />
              <div className="mt-[20px]">
                <ListingGrid listings={recentlyAdded} savedIds={savedIds} votedIds={votedIds} />
              </div>
            </SectionShell>
          </Reveal>
        )}

        {/* ── Hidden gems ──────────────────────────────────────────────────── */}
        {hiddenGems.length > 0 && (
          <Reveal>
            <SectionShell spacing="tight">
              <SectionHeader
                eyebrow="Worth a look"
                title="Hidden gems"
                description="Solid recommendations that haven't hit the top of the list yet."
                action={
                  <span className="flex items-center gap-[4px] text-[12.5px] font-medium text-[var(--muted)]">
                    <Gem className="size-[13px]" />
                  </span>
                }
              />
              <div className="mt-[20px]">
                <ListingGrid listings={hiddenGems} savedIds={savedIds} votedIds={votedIds} trendingIds={trendingIds} />
              </div>
            </SectionShell>
          </Reveal>
        )}

        {/* ── Categories ───────────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <Reveal>
            <SectionShell spacing="tight" className="pb-[80px]">
              <SectionHeader eyebrow="Browse" title="Categories" description="Explore by what you're looking for." />
              <div className="mt-[20px]">
                <Grid cols={4} gap="sm">
                  {categories.map((category) => (
                    <CategoryTile
                      key={category.id}
                      category={mapCategory(category)}
                      description={category.description}
                    />
                  ))}
                </Grid>
              </div>
            </SectionShell>
          </Reveal>
        )}
      </div>
    </PageTransition>
  );
}

function HomeUnavailable() {
  return (
    <PageTransition>
      <section
        className="relative flex items-center justify-center overflow-hidden px-[var(--page-gutter)]"
        style={{ minHeight: "calc(100svh - var(--topbar-height))" }}
      >
        <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
          <h1
            className="mb-[20px]"
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            What&rsquo;s worth your time?
          </h1>
          <p className="mb-[30px] max-w-[420px] text-[14px] leading-[1.7] text-[var(--text-soft)]">
            Crossing.dev is temporarily unavailable. Please check back shortly.
          </p>
          <ArrowRight className="size-[14px] text-[var(--muted)]" aria-hidden />
        </div>
      </section>
    </PageTransition>
  );
}
