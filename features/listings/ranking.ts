/**
 * Ranking v0 — deterministic, explainable, no ML, no personalization.
 * See docs/ranking-v0.md for the full rationale and known weaknesses.
 *
 * `computeRankingScore` is a pure function (easy to unit-test, no DB).
 * `recomputeRankingScores` is the batch job that reads current counters,
 * calls the pure function, and persists the result — run periodically
 * (cron / manual admin trigger), never inline on every vote or save.
 */

import { db } from "@/lib/db";

export const RANKING_CONFIG = {
  VOTE_WEIGHT: 10,
  SAVE_WEIGHT: 5,
  RECENT_ACTIVITY_WEIGHT: 8,
  VIEW_WEIGHT: 1,
  GRAVITY: 1.5,
  GRAVITY_OFFSET: 2,
  EDITORIAL_BOOST_MAX: 20,
  FRESHNESS_BONUS_MAX: 15,
  FRESHNESS_WINDOW_DAYS: 7,
  RECENT_ACTIVITY_WINDOW_DAYS: 14,
} as const;

const DAY_MS = 86_400_000;

export interface RankingInput {
  voteCount: number;
  saveCount: number;
  viewCount: number;
  /** Votes + saves within the last RECENT_ACTIVITY_WINDOW_DAYS — engagement velocity, not lifetime totals. */
  recentActivityCount: number;
  editorialBoost: number;
  publishedAt: Date;
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
}

/**
 * Pure, deterministic ranking score. Same inputs always produce the same
 * output — no randomness, no external calls.
 */
export function computeRankingScore(input: RankingInput): number {
  const now = input.now ?? new Date();
  const ageInDays = Math.max(0, (now.getTime() - input.publishedAt.getTime()) / DAY_MS);
  const boost = Math.min(Math.max(input.editorialBoost, 0), RANKING_CONFIG.EDITORIAL_BOOST_MAX);

  // Raw trust/popularity signal. Views use log10 so raw traffic can never
  // outweigh a single vote or save — 10,000 views ≈ 4 points, one vote = 10.
  const signal =
    RANKING_CONFIG.VOTE_WEIGHT * input.voteCount +
    RANKING_CONFIG.SAVE_WEIGHT * input.saveCount +
    RANKING_CONFIG.RECENT_ACTIVITY_WEIGHT * input.recentActivityCount +
    RANKING_CONFIG.VIEW_WEIGHT * Math.log10(input.viewCount + 1) +
    boost;

  // Time decay (HN-style gravity) — old incumbents fade even if their
  // lifetime totals stay high.
  const decayed = signal / Math.pow(ageInDays + RANKING_CONFIG.GRAVITY_OFFSET, RANKING_CONFIG.GRAVITY);

  // Freshness bonus — added AFTER decay, not decayed itself, so a listing
  // published minutes ago with zero engagement still gets a window of
  // visibility instead of scoring exactly 0 forever.
  const freshness =
    ageInDays >= RANKING_CONFIG.FRESHNESS_WINDOW_DAYS
      ? 0
      : RANKING_CONFIG.FRESHNESS_BONUS_MAX * (1 - ageInDays / RANKING_CONFIG.FRESHNESS_WINDOW_DAYS);

  return Math.round((decayed + freshness) * 1000) / 1000;
}

/**
 * Recomputes and persists `rankingScore` for every PUBLISHED listing.
 * Not exposed to the frontend — call from a cron route or an admin action
 * once one exists. O(published listings) — fine at MVP scale, revisit if
 * the catalog grows past a few thousand listings.
 */
export async function recomputeRankingScores(now: Date = new Date()): Promise<{ updated: number }> {
  const windowStart = new Date(now.getTime() - RANKING_CONFIG.RECENT_ACTIVITY_WINDOW_DAYS * DAY_MS);

  const [listings, recentVotes, recentSaves] = await Promise.all([
    db.listing.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        voteCount: true,
        saveCount: true,
        viewCount: true,
        editorialBoost: true,
        publishedAt: true,
      },
    }),
    db.vote.groupBy({
      by: ["listingId"],
      where: { createdAt: { gte: windowStart } },
      _count: { _all: true },
    }),
    db.save.groupBy({
      by: ["listingId"],
      where: { createdAt: { gte: windowStart } },
      _count: { _all: true },
    }),
  ]);

  const recentActivity = new Map<string, number>();
  for (const row of recentVotes) {
    recentActivity.set(row.listingId, (recentActivity.get(row.listingId) ?? 0) + row._count._all);
  }
  for (const row of recentSaves) {
    recentActivity.set(row.listingId, (recentActivity.get(row.listingId) ?? 0) + row._count._all);
  }

  if (listings.length === 0) return { updated: 0 };

  await db.$transaction(
    listings.map((listing) =>
      db.listing.update({
        where: { id: listing.id },
        data: {
          rankingScore: computeRankingScore({
            voteCount: listing.voteCount,
            saveCount: listing.saveCount,
            viewCount: listing.viewCount,
            recentActivityCount: recentActivity.get(listing.id) ?? 0,
            editorialBoost: listing.editorialBoost,
            publishedAt: listing.publishedAt,
            now,
          }),
        },
      })
    )
  );

  return { updated: listings.length };
}
