# Live search architecture

Audit of the production search path as it exists today, and the design of the
staged live-search orchestrator that replaces it.

Audit performed 2026-07-27 against `main`. Every claim below cites the file and
line that produces the behavior; live figures come from the production Neon
database, queried directly.

---

## Part 1 — Audit of the current production path

### 1.1 The complete current flow

```
POST /api/recommend                       app/api/recommend/route.ts
  ├── rateLimit(recommend:<ip>, 20/60s)   lib/server/rate-limit.ts
  ├── searchRequestSchema.safeParse       features/recommendation/api.ts:48
  └── searchRecommendations()             features/recommendation/api.ts:250
        ├── resolveDataMode(env)          features/recommendation/data-mode.ts:36
        │     └── blocks in prod unless ALLOW_SEEDED_DATA=true
        └── runRecommendation()           features/recommendation/recommend.ts:181
              ├── corpus = buildFixtures(now)          ← line 187  (SEEDED)
              ├── [opt] applyConfiguredMerge()         ← line 201  (ingestion overlay)
              ├── parseQuerySafe(deterministicParser)  ← line 211
              ├── applyOverrides()                     ← line 212
              ├── resolveCategory()          THE GATE  ← line 218
              │     └── status !== "supported" → unresolvedResult(), no retrieval
              ├── candidate retrieval                  ← lines 237–252
              │     ├── FEATURE_DB_ENTITIES on  → PrismaEntityRepository.findCandidates()
              │     └── otherwise               → discoverCandidates(categoryId, corpus)
              ├── resolveEntities()                    ← line 254 (exact domain-key dedup)
              ├── scoreCandidate() per candidate       ← line 262
              ├── split eligible / ineligible, sort    ← lines 267–270
              ├── best = eligible[0]                   ← line 273
              └── alternatives = eligible.slice(1, max(wanted,3))  ← line 274
        └── toSearchResponse()             features/recommendation/api.ts:191
              └── { status: "success", bestMatch, alternatives, … }
                                           components/search/search-experience.tsx:234
```

**Cache behavior: there is none.** No `unstable_cache`, no `revalidate`, no
route segment config, and no in-process memo anywhere in `app/api/recommend/` or
`features/recommendation/`. Every request re-runs the entire pipeline. This is
currently harmless (the pipeline is pure and in-memory) and becomes a hard
requirement to fix once discovery does network I/O.

### 1.2 Where seeded candidates still enter production

Three distinct entry points, in order of severity.

**(a) The default corpus is fictional — `recommend.ts:187`.**

```ts
let corpus = options.corpus ?? buildFixtures(now);
```

`FEATURE_DB_ENTITIES` defaults **off** (`lib/server/feature-flags.ts` — only
`on|true|1` enables). `/api/recommend` passes no `corpus`. So on any deployment
that has not explicitly set the flag, `discoverCandidates()` filters
`buildFixtures()` and **100% of returned results are invented products** —
DriftDeploy, Glyph Code, Ironclad Host, Tally Metrics. They have invented
ratings, invented review counts, and invented Reddit/Trustpilot/GitHub sources.

This is the single most serious finding: the fixture corpus was built as a Phase-1
test harness and is still the production default.

**(b) `resolveDataMode()` is the only thing standing between fixtures and prod.**

`data-mode.ts:21` hardcodes `DATA_MODE = "seeded"`. In production the guard
returns `allowed: false` and the API returns a 503 `seeded_data_unavailable`.
So production today does not serve fiction — it serves *nothing*. The product is
gated off rather than correct. Flipping `ALLOW_SEEDED_DATA=true` to "make search
work" would immediately serve invented products as real recommendations.

**(c) The ingestion overlay enriches fixtures rather than replacing them.**

`recommend.ts:189–209` overlays stored official-site snapshots onto the *seeded*
corpus when `INGESTION_MERGE_CATEGORIES`/`_ENTITIES` is set. It improves the
attributes of fictional entities. It never introduces a real one.

### 1.3 Why result count is limited to ~3

Four compounding caps. Removing any one alone changes nothing.

| # | Cap | Location | Effect |
|---|---|---|---|
| 1 | `DEFAULT_RESULT_COUNT = 3` | `query/schema.ts:62` | default `requestedResultCount` is 3 |
| 2 | `MAX_RESULT_COUNT = 10` | `query/schema.ts:63` | hard ceiling, even if the user asks for 20 |
| 3 | `alternatives = eligible.slice(1, Math.max(wanted, 3))` | `recommend.ts:274` | with `wanted=3` → `slice(1,3)` → **2** alternatives + 1 best = **3 total** |
| 4 | Corpus size | `fixtures.ts` | 17 entities / 7 categories = **2–3 per category** |

Cap 4 is the binding one. Even with caps 1–3 lifted, no category can yield more
than 3 candidates because no category *contains* more than 3.

Live figures, queried from production Postgres on 2026-07-27:

```
Entity table
  analytics-tools / ACTIVE  / CANONICAL   2      ← the only rankable real entities
  analytics-tools / DRAFT   / CANONICAL   1      ← Plausible, excluded (readiness: needs-review)
  (no other category has a single row)

EvidenceSnapshot table
  fathom-analytics    ok=true   1
  matomo              ok=true   1
  plausible-analytics ok=true   1
```

So with `FEATURE_DB_ENTITIES=on`, the *entire* real catalog is **2 rankable
entities in 1 category**. Every other category returns `no-results`. This matches
the live behavior observed earlier: `"developer tools"` → `no-results` with
`candidateSource: "db"`.

### 1.4 Why real entities are not broadly discovered

**There is no discovery mechanism.** Both candidate paths are lookups over a
manually authored list:

- **Fixture path** — `candidates/discover.ts:25` is literally
  `corpus.filter(e => e.categoryId === categoryId)` over a hardcoded array.
- **DB path** — `repository.ts:123` is
  `SELECT … WHERE categoryId=? AND status='ACTIVE' AND source='CANONICAL'`.
  That table is populated *only* by `scripts/backfill-entities.ts`, which upserts
  the hand-written 3-item list in `features/entities/canonical.ts`.
- **Ingestion** — `features/ingestion/registry.ts` fetches evidence only for
  entities already present in a hand-written approved-domain allowlist
  (`PILOT_ENTITY_IDS`, the same 3). Ingestion *enriches known entities*; it does
  not *find* entities.

Nothing in the codebase enumerates a search index, a directory, a package
registry, a category listing, or any external corpus. Adding a candidate to
Crossing today requires a developer to edit `canonical.ts`, edit `registry.ts`,
and run two scripts. That is why coverage is 2 entities.

The comment at `candidates/discover.ts:12` names Postgres FTS as the intended
seam — but FTS over a 2-row table is still 2 rows. **The missing piece is
upstream of retrieval: there is no candidate *sourcing* stage at all.**

### 1.5 Which categories are truly supported

Seven are *declared* in `categories/definitions.ts`: developer-tools, ai-tools,
productivity-tools, design-tools, hosting-platforms, email-platforms,
analytics-tools.

Actual support depends on the path:

| Category | Fixture entities | Real ACTIVE entities | Truly supported? |
|---|---|---|---|
| analytics-tools | 2 | **2** | partially — 2 candidates |
| developer-tools | 3 | 0 | no |
| hosting-platforms | 3 | 0 | no |
| productivity-tools | 3 | 0 | no |
| ai-tools | 2 | 0 | no |
| design-tools | 2 | 0 | no |
| email-platforms | 2 | 0 | no |

**Real coverage is 1 of 7 categories and 2 entities.** The category gate
(`categories/resolve.ts`) will happily resolve `"best email platform"` to
`email-platforms` with high confidence and then return `no-results`, because the
gate validates the *category vocabulary*, not whether any candidate exists in it.
That mismatch — confident resolution into an empty category — is a distinct bug
class the orchestrator must close.

### 1.6 Which code assumes one winner plus a few alternatives

The one-winner shape is load-bearing across six layers:

| Layer | Site | Assumption |
|---|---|---|
| Core result | `types.ts:102-103` | `best: RecommendedItem \| null` + `alternatives: RecommendedItem[]` |
| Orchestrator | `recommend.ts:273-274` | `best = eligible[0]`, alternatives are `slice(1, …)` |
| Confidence | `recommend.ts:131-137` | `overallConfidence` blends the **margin between #1 and #2** — a concept that only exists if there is a single winner |
| Explanation | `types.ts:67-74`, `explain.ts` | `ExplanationInput { best: ExplanationSubject \| null; alternatives: […] }` |
| Wire contract | `api.ts:92-97` | `bestMatch`, `bestMatchClaims`, `alternatives` as separate fields |
| UI | `search-experience.tsx:234-240` | `<ResultCard variant="best">` then an `"Strong alternatives"` heading |

Note `overallConfidence` in particular: on a 10–20 item ranked list, "margin over
the runner-up" is not a meaningful confidence signal, and it actively *penalizes*
a healthy result set where several strong options cluster together. A ranked-list
contract needs a different confidence model (evidence coverage and constraint
satisfaction, not winner separation).

### 1.7 Which fields are factual versus review-derived

This is the distinction the current engine blurs.

**Factual — asserted by the official site, verifiable, provenance-tracked:**

`RANKING_FACTUAL_ATTRIBUTES` (`features/ingestion/evidence.ts:18`) permits exactly
three into ranking: `priceMonthly`, `hasFreePlan`, `platforms`. Also extracted but
deliberately *excluded* from ranking (audit/provenance only): `hasFreeTrial`,
`integrations`, `features`.

**Review-derived — reputation signals, currently non-existent in production:**

`rating`, `ratingScale`, `reviewCount`, `reviewTopics` (`evidence/types.ts:46-62`).

`toRecommendationEvidence()` (`evidence.ts:126-144`) hardcodes:

```ts
rating: null,
ratingScale: null,
reviewCount: 0,
```

with the correct comment *"Official-site evidence is factual only — it NEVER
asserts a consumer rating."* That discipline is right. **The consequence is that
in production there is no review evidence at all** — every real entity has
`rating: null`, `reviewCount: 0`, and no `reviewTopics`.

Ratings and review topics exist **only in `fixtures.ts`**, where they are invented.

### 1.8 Which source types currently influence ranking

`EvidenceSourceType` declares eight members. Production emits exactly **one**:

| Source type | Declared in category `supportedSources` | Adapter exists? | Reaches production ranking? |
|---|---|---|---|
| `official` | all 7 categories | ✅ `features/ingestion/` | **yes — the only one** |
| `documentation` | 4 categories | ❌ | no (fixtures only) |
| `github` | 3 categories | ❌ | no (fixtures only) |
| `reddit` | all 7 categories | ❌ | no (fixtures only) |
| `trustpilot` | 3 categories | ❌ | no (fixtures only) |
| `app_store` | 3 categories | ❌ | no (fixtures only) |
| `pricing_page` | none | partial (folded into `official`) | no |
| `editorial` | none | ❌ | no |

### 1.9 How official-site evidence gets mistaken for quality evidence

This is the most important structural finding, and it is subtler than "official
data is treated as a rating."

Trace a real entity (Matomo) through `scoreCandidate()`:

1. **`generalQualityScore`** (`score.ts:224`) iterates evidence and does
   `if (norm === null) continue`. Official evidence has `rating: null`, so it is
   skipped. `weightSum` stays 0, and the function returns the **Bayesian category
   prior** — `categoryAverageRating`, `0.8` for analytics-tools.
2. **`reviewConfidenceScore(0)`** returns `0`.
3. **`topicSentimentScore`** finds no `reviewTopics` and returns the neutral `0.5`.

So for *every* real entity these three components are **constant**: `0.8`, `0`,
`0.5`. They carry no discriminating information whatsoever. Yet in
`analytics-tools` they hold combined weight `0.22 + 0.14 + 0.08 = 0.44` — **44% of
the ranking weight is inert**, contributing an identical constant to every
candidate.

Ranking between real entities is therefore decided by what remains:
`constraintFit` (0.20), `queryRelevance` (0.20), `sourceDiversity` (0.06),
`freshness` (0.06), and `semanticRelevance` (0.05 — itself a hardcoded `0.5`
placeholder at `score.ts:362`).

Two of those survivors are *properties of the marketing page*, not the product:

- **`sourceDiversityScore`** (`score.ts:283`) counts distinct source types over
  `SOURCE_DIVERSITY_TARGET = 4`. A real entity has exactly one source type
  (`official`) → **0.25 for everyone**, plus a `+0.25` risk penalty from
  `riskLevel`'s *"Backed by only a single source"* branch (`score.ts:311`).
- **`queryRelevanceScore`** (`score.ts:201`) does substring matching over the
  entity's name, description, and *searchable attributes* — which for a real
  entity are the strings ingestion scraped from the homepage (`features`,
  `platforms`). A vendor with a keyword-dense marketing page scores higher.

**The precise statement of the problem:** official-site evidence is not literally
scored *as* a rating — the code is careful about that. But because it is the only
evidence that exists, quality collapses to a per-category constant, and the
ranking that remains is driven by how well-structured and keyword-rich a vendor's
own marketing page is. A well-merchandised product outranks a better one. That is
functionally indistinguishable from treating marketing copy as a quality signal,
and it is why the current output is not competitive with a general assistant's
recommendations.

### 1.10 Summary of root causes

| # | Root cause | Consequence |
|---|---|---|
| 1 | No candidate *sourcing* stage exists — only lookup over a hand-authored list | 2 real entities; coverage cannot grow without developer edits |
| 2 | Fixture corpus is the default in `runRecommendation` | production is either fictional or 503-gated |
| 3 | `alternatives = slice(1, max(wanted,3))` with `DEFAULT_RESULT_COUNT=3` | ~3 results even when more exist |
| 4 | No independent-review adapter | 44% of ranking weight is an inert constant |
| 5 | One-winner contract across 6 layers | cannot express a ranked list of 10–20 |
| 6 | Category gate validates vocabulary, not candidate availability | confident resolution into an empty category |
| 7 | No caching anywhere | pipeline cannot afford network I/O as designed |

---

## Part 2 — The live-search orchestrator

### 2.1 Design principles

1. **Staged, not agentic.** Nine named stages with typed inputs and outputs. Each
   is a pure-ish function that can be unit-tested in isolation and observed in a
   trace. There is no single opaque "figure it out" call.
2. **Deterministic where possible.** Filtering and ranking stay pure and
   code-driven — an LLM never picks or orders results. Bounded model use is
   permitted only inside `parse` (interpretation) and `normalize` (entity
   dedup/alias resolution), both of which validate their output against a schema
   and both of which have a deterministic fallback.
3. **Provenance is never lost.** Every attribute and every ranked item carries the
   source URL and retrieval time that justified it.
4. **Absence is reported, not filled.** A missing rating stays `null` and is
   surfaced as a coverage gap. No stage invents a number to make a card look full.

### 2.2 Stage pipeline

```
SearchRequest
  → parse            interpret the request into a validated StructuredQuery
  → resolve          domain/category + candidate-availability check
  → discover         source a broad candidate pool (the missing stage)
  → normalize        canonicalize names/domains, drop junk
  → resolveEntities  dedup to canonical entities, merge duplicates
  → gatherEvidence   factual (official) + independent (review/reputation)
  → filter           hard-constraint eligibility
  → rank             deterministic weighted scoring
  → respond          RankedSearchResponse
```

Each stage implements a common contract so it can be traced and tested uniformly:

```ts
interface Stage<In, Out> {
  readonly name: StageName;
  run(input: In, ctx: SearchContext): Promise<StageResult<Out>>;
}

interface StageResult<T> {
  output: T;
  /** Non-fatal problems: a source timed out, a page 404'd, a field was absent. */
  issues: StageIssue[];
  /** Observability: wall time, item counts in/out, external calls made. */
  metrics: StageMetrics;
}
```

`SearchContext` carries the request id, the injectable clock, the env, and an
`AbortSignal` so a slow external source cannot hang a request.

### 2.3 The orchestrator interface

```ts
interface SearchOrchestrator {
  search(input: SearchRequest): Promise<RankedSearchResponse>;
}
```

`RankedSearchResponse` replaces the one-winner contract with a ranked list:

```ts
type RankedSearchResponse =
  | { status: "ranked";      results: RankedResult[]; /* 10–20 typical */ … }
  | { status: "sparse";      results: RankedResult[]; coverage: CoverageReport; … }
  | { status: "no-results";  … }
  | { status: "unsupported-category"; … }
  | { status: "needs-clarification"; … }
  | { status: "error";       … };
```

`sparse` is a new, deliberately distinct state: we found *some* candidates but
materially fewer than a good answer needs, or with materially thin evidence. It
is honest where the current contract would silently present 2 results as if that
were the whole market.

Every `RankedResult` carries an explicit `EvidenceCoverage` block naming which
signals were present, which were absent, and which are estimated — so the UI can
say "no independent reviews found" instead of rendering an empty 5-star row.

### 2.4 Relationship to the existing engine

The orchestrator **reuses** the parts of the current engine that are sound and
well-tested, and replaces the parts the audit found broken:

| Existing module | Disposition |
|---|---|
| `query/parser.ts`, `query/schema.ts` | **reused** as the `parse` stage (with `DEFAULT_RESULT_COUNT` raised) |
| `categories/resolve.ts` | **reused** as `resolve`, extended with an availability check (§1.5) |
| `ranking/score.ts` | **reused**, with weight rebalancing once review evidence exists (§1.9) |
| `evidence/bayesian.ts` | **reused** unchanged |
| `entities/normalize.ts` | **extended** — exact domain-key dedup is too strict for discovered candidates |
| `candidates/discover.ts` | **replaced** by the `discover` stage |
| `fixtures.ts` | **demoted** to tests only; never reachable from `/api/recommend` |
| `recommend.ts` `best`/`alternatives` | **replaced** by the ranked-list contract |

### 2.5 What has landed

All nine stages, the contracts, the source adapter seam, and the orchestrator
are implemented and tested (50 tests: 31 per-stage, 19 end-to-end, all hermetic —
no database, no network).

```
features/search/
  contracts.ts              Stage/StageResult/SearchContext, RankedSearchResponse
  orchestrator.ts           StagedSearchOrchestrator — the runner
  default.ts                production wiring + test seam
  sources/
    types.ts                DiscoverySource / EvidenceSource / enforceIndependence
    catalog.ts              CatalogDiscoverySource   (canonical Entity table)
    official-site.ts        OfficialSiteEvidenceSource (vendor, batched)
  stages/
    interpret.ts            parse, resolve
    discovery.ts            discover, normalize, resolveEntities
    evidence.ts             gatherEvidence
    ranking.ts              filter, rank
```

Against the root causes in §1.10:

| # | Root cause | Status |
|---|---|---|
| 1 | No candidate sourcing stage | **structurally fixed** — `discover` exists, fans out across registered sources in parallel, fault-isolated. Still only one source registered (§2.6). |
| 2 | Fixture corpus is the production default | **fixed** — `requireCanonical` defaults to `true`; a demo corpus is unservable unless a caller explicitly opts in. Covered by a test. |
| 3 | `alternatives = slice(1, max(wanted,3))` | **fixed** — `TARGET_RESULT_COUNT = 12`, cap 20, list-shaped output. |
| 4 | No independent-review adapter | **enforced, not yet supplied** — `enforceIndependence` makes it structurally impossible for a vendor source to assert a rating, and coverage reports the absence. No independent source exists yet (§2.6). |
| 5 | One-winner contract | **fixed** — `RankedResult[]` with 1-based ranks and no winner field. |
| 6 | Gate validates vocabulary, not availability | **fixed** — `ResolveStage` availability probe; an empty category short-circuits with an honest message. |
| 7 | No caching | **not yet addressed** — still safe, because no registered source does network I/O. Required before one does. |

### 2.6 The live pipeline (Parts 3–15)

Built on top of §2.5. Configuration: [search-configuration.md](./search-configuration.md).

```
features/search/
  live-orchestrator.ts      the integrated pipeline
  live-default.ts           production wiring + capability reporting
  response.ts               public ranked contract + cursor pagination
  copy.ts                   every public string; BANNED_PUBLIC_TERMS
  cache.ts                  3 caches, request dedup, SWR, enrichment queue
  diagnostics.ts            per-search trace (dev/admin only)
  providers/                provider-agnostic web search (4 vendors)
  discovery/                6 layers + layered runner + agentic fallback
  resolution/               6-strategy resolution ladder
  evidence/classes.ts       official | independent | editorial
  ranking/profiles.ts       category ranking profiles
```

Key behaviors, each covered by a test:

- **Layered discovery stops early.** Canonical is free; web search costs money.
  A well-covered category never pays for the paid tiers.
- **Discovery cannot promote.** Every adapter emits `DiscoveredCandidate` — an
  untrusted mention. Only `resolution/` maps one onto a canonical entity, and
  fuzzy name matching can only ever produce `probable-duplicate` (human review),
  never an automatic merge.
- **Reputation is structurally separated.** `enforceIndependence` (by source
  independence) and `stripOfficialReputation` (by source type) are two
  independent chokepoints. A vendor rating cannot reach a score by any path.
- **Missing evidence costs.** `scoreBroad` scores an absent rating as `0` with a
  `missingDataPenalty`, rather than substituting the category average — which is
  the direct fix for §1.9.
- **Nothing is crawled inline.** Missing/stale evidence is enqueued for the
  background worker; the request returns with what exists.

### 2.7 Deliberately not built

Two things the brief asks for are **architecturally ready but intentionally not
implemented**, because building them requires a decision that is not mine to make:

**A broad discovery source.** `discover` fans out across a `DiscoverySource[]`,
but only `CatalogDiscoverySource` is registered — so real-world coverage is still
the 2 canonical entities from §1.3. Registering a web-index or directory source
is a one-line change to `default.ts` and needs no change to any stage. It is not
done here because choosing that source means choosing a third-party service and
accepting its terms, cost, and rate limits.

**An independent review/reputation source.** The `independence` field, the
`enforceIndependence` chokepoint, and the `EvidenceCoverage` reporting all exist
specifically to make such a source safe to add. None is registered, because the
standing project constraint prohibits GitHub, Trustpilot, Yelp, and Google
Places, and no replacement has been approved.

The consequence is honest rather than hidden: with only vendor evidence
available, every response carries `coverage.withIndependentEvidence: 0`, the
warning *"Ranking is based on vendor-published facts only"*, and a per-result
tradeoff stating the gap. A 2-entity category returns `sparse`, not a confident
top-3.

---

## Part 3 — `/api/recommend` wiring

The route now runs `getLiveSearch()`. The old `searchRecommendations()` path,
`buildFixtures()`, and `resolveDataMode()` are no longer reachable from it.

**Two contracts, one pipeline:**

| Request | Response |
|---|---|
| *(default)* | legacy `{ bestMatch, alternatives, seeded, … }` |
| `contract: "ranked"` | full `RankedSearchResponse` (10–20 results, coverage, `nextCursor`) |

The legacy shape is a **projection** of the ranked list
(`features/search/compat.ts`), not a second engine: `bestMatch` is literally
`results[0]` and `alternatives` is `results.slice(1)`, order preserved. Tests
assert that identity so the two can never diverge.

This keeps the existing search UI working untouched — presentation is owned by
another track — while the pipeline underneath is fully replaced. Information the
old contract has no field for (evidence coverage, per-result evidence strength)
is folded into `warnings` and `tradeoffs` rather than dropped, so an old-contract
client still learns that reviews were missing.

Two behavior changes visible through the legacy shape, both deliberate:

- `seeded` is now always `false` and `dataMode` always `"live"` — the live
  pipeline has no seeded path (Part 13). The UI's prototype-data banner
  therefore no longer appears.
- `confidenceLevel` now derives from **evidence strength across the top
  results**, not from `overallConfidence()`'s parser-confidence-plus-winner-margin
  blend, which §1.6 found meaningless on a ranked list.

`compat.ts` is deliberately disposable: when the UI consumes
`RankedSearchResponse` directly, the default flips and the file is deleted.

### Known frontend mismatch (not fixed here)

`components/search/search-experience.tsx` renders a hardcoded **"UNDERSTOOD AS"**
label above the category. That is exactly the model-training vocabulary Part 11
bans. It is frontend copy, not a response field — the API no longer emits any
such wording — so fixing it belongs to the presentation track.
