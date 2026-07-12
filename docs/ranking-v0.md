# Ranking v0

The formula that orders listings on "trending" surfaces (category pages,
search, any future homepage feed). Implemented in
[`features/listings/ranking.ts`](../features/listings/ranking.ts) as a pure
function, `computeRankingScore`, with tests in
[`ranking.test.ts`](../features/listings/ranking.test.ts).

## Constraints this had to satisfy

From the product brief: no machine learning, no personalization, no opaque
external API, no paid promotion. It also had to avoid being a pure popularity
ranking (view-count contest), apply time decay so old incumbents don't
permanently dominate, and stay transparent enough to explain in one page.

## The formula

```
signal   = VOTE_WEIGHT   × voteCount
         + SAVE_WEIGHT   × saveCount
         + RECENT_WEIGHT × recentActivityCount
         + VIEW_WEIGHT   × log10(viewCount + 1)
         + editorialBoost                        // clamped to [0, EDITORIAL_BOOST_MAX]

decayed  = signal / (ageInDays + GRAVITY_OFFSET) ^ GRAVITY

freshness = ageInDays >= FRESHNESS_WINDOW_DAYS
          ? 0
          : FRESHNESS_BONUS_MAX × (1 − ageInDays / FRESHNESS_WINDOW_DAYS)

rankingScore = decayed + freshness
```

Current constants (`RANKING_CONFIG` in `ranking.ts`):

| Constant | Value | Purpose |
|---|---|---|
| `VOTE_WEIGHT` | 10 | Primary trust signal — an explicit "recommend this." |
| `SAVE_WEIGHT` | 5 | Weaker signal than a vote — a private bookmark, not a public endorsement. |
| `RECENT_ACTIVITY_WEIGHT` | 8 | Votes + saves in the last `RECENT_ACTIVITY_WINDOW_DAYS` (14). Rewards a listing that's *currently* getting attention, independent of its lifetime total — this is what lets a listing with fewer total votes but a recent burst of activity outrank a stale listing sitting on old totals. |
| `VIEW_WEIGHT` | 1 | Applied to `log10(viewCount + 1)`, not raw views. At 10,000 views this contributes 4 points — less than a single vote (10 points) — so raw traffic can never dominate trust signals. This is the direct mechanism for "avoid a pure popularity ranking." |
| `GRAVITY` / `GRAVITY_OFFSET` | 1.5 / 2 | HN-style time decay. The `+2` offset keeps the denominator sane for brand-new listings (age ≈ 0) instead of dividing by something close to zero. |
| `EDITORIAL_BOOST_MAX` | 20 | Hard cap on the manual nudge — roughly equivalent to two extra votes' worth of weight, not enough to override genuine community signal on its own. Clamped in `computeRankingScore` itself, not just at the input layer, so a bad write to the DB can't silently break the cap. |
| `FRESHNESS_BONUS_MAX` / `FRESHNESS_WINDOW_DAYS` | 15 / 7 | A temporary visibility boost for the first week after publish, decaying linearly to 0. Added **after** the time-decay division (not decayed itself) — this is what gives a listing with zero votes on day one a nonzero score instead of ranking at the very bottom until it gets its first vote. Distinct from `RECENT_ACTIVITY_WEIGHT`: freshness rewards the listing being *new*, recent-activity rewards the listing being *currently engaged with*, regardless of age. |

## Why votes/saves are cached counters, not live counts

`Listing.voteCount` / `saveCount` / `viewCount` are denormalized columns
updated by the save/vote data-access functions
(`features/saves/data.ts`, `features/votes/data.ts`) inside the same
transaction as the Save/Vote row. Reading them for ranking is then a single
row scan instead of a `COUNT(*)` join per listing per request.

## Why the score is recomputed periodically, not on every vote

`rankingScore` is written by `recomputeRankingScores()`, a batch function
over every `PUBLISHED` listing, meant to run on a schedule (cron route once
one exists) or an admin-triggered action — not synchronously inside the
vote/save mutation. Two reasons:

1. `recentActivityCount` requires a windowed aggregate query (`Vote`/`Save`
   rows grouped by listing within the last 14 days) across the *whole*
   catalog to stay comparable — computing it for one listing in isolation on
   every vote would be wasted work for a score that only matters relative to
   every other listing's score at read time.
2. It matches the product doc's own framing: ranking score is "recomputed
   periodically, not read directly from a single field a user can see"
   (`docs/product-scope.md`) — it's an ordering mechanism, not a live counter.

The listing detail page still shows live `voteCount`/`saveCount` — those
update immediately. Only the *derived ranking position* lags until the next
recompute.

## Known weaknesses (v0, by design)

- **Recompute lag.** Between runs, a listing's rank doesn't reflect its very
  latest votes/saves — only its cached counters do (visible on the listing
  itself, just not yet reflected in sort order). Acceptable at MVP traffic;
  revisit if "just voted and expected to see it move" becomes a real
  complaint.
- **O(published listings) batch job.** `recomputeRankingScores` loads every
  published listing into memory and updates them in one transaction. Fine
  at hundreds/low-thousands of listings; would need batching/pagination
  before that stops being true.
- **No per-category normalization.** A new, low-traffic category (e.g.
  "Communities") competes against listings in a large, high-engagement
  category (e.g. "AI tools") using the same absolute weights. A listing can
  be the best thing in a quiet category and still score below mediocre
  listings in a loud one. Category pages sort within-category so this only
  bites on any future cross-category "trending" feed.
- **No spam/bot resistance beyond one-vote-per-user.** The unique
  constraint on `(userId, listingId)` stops double-voting, but coordinated
  vote rings across many accounts aren't detected or down-weighted. Nothing
  in v0 addresses this beyond standard auth (no anonymous voting) and
  route-level rate limiting.
- **Fixed, hand-picked weights.** They're reasoned about above, not fit to
  real engagement data — there isn't any yet. Expect to retune once real
  usage exists, and to eventually want per-signal weight experiments, which
  v0 deliberately doesn't build (no ML, no experimentation framework).
- **Editorial boost is manual and unaudited beyond the existing admin audit
  log conventions.** There's no dedicated UI for setting it in this pass —
  the field and its cap exist in the schema, and any future admin route
  that writes it should call `writeAuditLog()` like every other destructive
  admin action.
