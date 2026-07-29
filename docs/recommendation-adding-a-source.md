# Adding an evidence-source adapter

The ranking engine never touches a raw source. Every source — an official site,
a pricing page, docs, GitHub, Reddit, an app store, and (later, only if
permitted) a review platform — is normalized into the single `Evidence` shape
(`features/recommendation/evidence/types.ts`) by an **adapter**. The engine only
ever sees `Evidence`.

> ⚠️ Legal/ToS first. `EvidenceSourceType` is an **allowlist**, not "anything on
> the web." Do not add a source that forbids automated collection or storage of
> its content. No live scraping, no Yelp, no Trustpilot scraping,  no browser
> automation, no autonomous browsing (see the project constraints and
> `docs/recommendation-engine-plan.md` §7). Phase 1 has no live adapters at all —
> data comes from `fixtures.ts`.

## The contract

An adapter is any function that, given an entity identity, returns normalized
`Evidence` records:

```ts
import type { Evidence } from "@/features/recommendation/evidence/types";

export interface SourceAdapter {
  /** Must match a member of EvidenceSourceType. */
  readonly sourceType: string;
  /**
   * Return normalized evidence for one entity. Runs in BACKGROUND jobs only
   * (never in the /api/recommend request path). Must be resilient: on failure,
   * return [] — a missing source degrades the result, never breaks it.
   */
  collect(input: { entityId: string; officialDomain: string }): Promise<Evidence[]>;
}
```

Every returned `Evidence` must set:

- `sourceType`, `sourceUrl`, `retrievedAt` (ISO) — provenance + freshness.
- `rating` + `ratingScale` when the source has a rating (else both `null`);
  `reviewCount` (`0` when unknown). Ratings on any scale are fine — the engine
  normalizes via `normalizedRating()`.
- `attributes` — structured facts keyed to category attribute keys
  (`priceMonthly`, `hasFreePlan`, `platforms`, …). These feed hard constraints
  and preferences.
- `confidence` (0..1) — how much you trust this source's data quality.
- `entityMatchConfidence` (0..1) — how sure you are this evidence is about *this*
  entity. Low values raise the candidate's risk penalty (see `riskLevel` in
  `ranking/score.ts`), which is exactly what you want for uncertain matches.
- `reviewTopics?` — optional `{ topic, sentiment (-1..1), mentions }` aggregates
  that feed topic-sentiment scoring.

## Steps

1. **Allowlist the source type.** Add the member to `EvidenceSourceType` in
   `features/recommendation/evidence/types.ts`, only after confirming its terms
   permit collection + storage.
2. **List it per category.** Add the new type to `supportedSources` for each
   `CategoryDefinition` that should trust it
   (`features/recommendation/categories/definitions.ts`). Source diversity only
   counts sources a category supports.
3. **Write the adapter** under `features/recommendation/sources/<name>.ts`
   implementing `SourceAdapter`. Keep it pure I/O + normalization; put no
   ranking logic here. Respect the source's rate limits inside the adapter.
4. **Wire it into a background refresh job**, not the request path. The intended
   home is `features/recommendation/jobs/refresh-evidence.ts` invoked by a Vercel
   Cron route (`app/api/cron/refresh-evidence/route.ts`), modeled on
   `recomputeRankingScores()` in `features/listings/ranking.ts`. The job writes
   `EvidenceSnapshot`/`Rating`/`Review` rows (Phase 2+ schema); the request path
   only ever *reads* them.
5. **Handle licensing.** Store raw review text (`Review.excerpt`) only when the
   source's license permits; otherwise store derived aggregates
   (ratings, topic sentiment) instead of raw content.

## Testing an adapter

Because the adapter returns plain `Evidence`, test it with a captured fixture
payload → assert the normalized output, with **no network in the test**. Then
add an entity to `fixtures.ts` (or a Phase-2 seed) carrying that evidence and let
the existing ranking tests exercise it end-to-end.

## What an adapter must never do

- Decide rankings or pick a winner (that is `ranking/score.ts`, deterministic).
- Run in the synchronous `/api/recommend` path.
- Invent ratings, prices, or review counts — absent data is `null`/`0`, not a guess.
