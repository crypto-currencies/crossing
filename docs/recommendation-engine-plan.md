# Recommendation engine — implementation plan

Status: **planning only.** This document audits the current repository and
proposes how to build the query-aware recommendation engine on top of it. No
product code changes are made by this document. Every recommendation below
references real files so the plan can be executed without re-deriving the
architecture.

Pipeline being planned:

```
user query
  → query interpretation
  → category detection
  → constraint extraction
  → candidate discovery
  → entity resolution
  → evidence collection
  → deterministic scoring
  → recommendation generation
  → evidence-backed explanation
```

Load-bearing constraints (carried through every section):

- No autonomous web-browsing agent.
- The LLM never decides the final ranking — scoring is a deterministic pure function.
- No Yelp / Trustpilot / Google Maps scraping.
- Prefer Postgres FTS + `pgvector` over Elasticsearch for the MVP.
- Reuse existing project conventions; don't retrofit new patterns everywhere.
- MVP corpus is **online tools & software only**.

---

## 1. Current architecture

### Framework & routing

- **Next.js 16 App Router**, TypeScript strict, Tailwind v4, React 19
  (`package.json`). Note `AGENTS.md`: this Next.js has breaking changes — read
  `node_modules/next/dist/docs/` before writing route/runtime code.
- Route groups under `app/`: `(root)` (marketing/public), `(auth)`,
  `(dashboard)`. API handlers live under `app/api/**/route.ts`.
- Route-handler shape is standardized in `docs/architecture.md` §"API route
  conventions": `DB_AVAILABLE` guard → auth → rate limit → validate → work →
  `NextResponse.json`. Example to copy: `app/api/listings/search/route.ts`.

### Database & ORM

- **Prisma 6 over `@prisma/adapter-pg`** against Postgres (`prisma/schema.prisma`,
  `lib/db.ts`). `db` is a lazy proxy; `DB_AVAILABLE` gates every DB-touching route.
- Migrations: `prisma/migrations/` (`20260710000000_baseline`,
  `20260710000001_add_discovery_domain`) with `migration_lock.toml`. Seed:
  `prisma/seed.ts` (`npm run db:seed`). Deploy runs `prisma migrate deploy`
  (`vercel-build` script).
- Existing discovery models (`prisma/schema.prisma`): `Category`, `Listing`,
  `Submission`, `Save`, `Vote`. **`Listing.websiteUrlKey` is a unique
  normalized-URL key** — the platform already enforces "one listing per site,"
  which is the seed of entity resolution (see §5).

### Auth (affects search history / personalization)

- NextAuth v4 (Google OAuth) **plus** a custom Bearer/cookie session system
  (`docs/architecture.md` §"Authentication flow"; `app/api/auth/*`,
  `lib/server/auth.ts`). Guards: `requireAuth`, `requireAdminApi`,
  `requireOwnerApi` (`lib/server/auth.ts`, `lib/server/admin.ts`) re-read the
  user from the DB every call.
- Client session state: `store/auth.ts` (Zustand, persisted).
- **Implication:** search can be fully anonymous. Any per-user search history
  must attach to `User.id` via `requireAuth` and is optional — the engine must
  work signed-out.

### API conventions

- Errors are `{ error: "snake_case_code" }` with optional `message`; never leak
  Prisma/stack traces. Admin routes return `403` not `401`.
- Rate limiting: `lib/server/rate-limit.ts` (Upstash sliding window, **fails
  open** when unconfigured). `clientIp()` extracts the principal. Search is
  already rate-limited at `30 / 60s / IP` in `app/api/listings/search/route.ts`.
- Pagination: `lib/server/pagination.ts` (`parsePageParams`, `PageParams`,
  `MAX_PAGE_SIZE = 50`); list results use `PagedResult<T>` (`features/listings/data.ts`).

### Background jobs / queues / cron

- **No queue or cron library installed** (no BullMQ, Inngest, pg-boss, etc.).
- Vercel Cron is the intended mechanism: `next.config.ts` sets Sentry
  `automaticVercelMonitors: true`, and `docs/ranking-v0.md` explicitly says the
  ranking recompute should run "cron / manual admin trigger." There is **no
  `vercel.json` yet** — cron schedules will need one.
- Existing batch-job pattern to copy: `recomputeRankingScores()` in
  `features/listings/ranking.ts` (reads counters → pure compute → `$transaction`
  persist). This is the template for every background refresh job.

### Redis / caching

- Upstash Redis is present **only** for rate limiting (`lib/server/rate-limit.ts`,
  `@upstash/redis`, `@upstash/ratelimit`). It can be reused as a result cache.
- Application caching: **none yet** (`docs/architecture.md` §"Caching
  conventions" — deliberately deferred until read traffic dominates). This is
  that moment.

### AI providers / embeddings / vector DB

- **None.** No `openai` / `@anthropic-ai/sdk` / `@ai-sdk/*`, no `pgvector`, no
  embeddings anywhere (`grep` over `package.json` and `lib/`/`features/`/`app/`).
- The only references to `tsvector` / `websearch_to_tsquery` are **aspirational
  comments** in `features/listings/search.ts` describing the intended FTS
  upgrade path. Current search is Prisma `contains` (ILIKE substring).

### Logging / analytics / error handling

- Sentry (`instrumentation.ts` `register()` + `onRequestError`,
  `sentry.server.config.ts`, `sentry.edge.config.ts`,
  `instrumentation-client.ts`). Server init is production-only.
- Boot-time env validation: `lib/server/env-validation.ts` (throws in prod on
  missing vars, warns in dev). Any new required env var (AI key, etc.) should be
  registered here.
- No product analytics pipeline; `Listing.viewCount` + `SecurityEvent` are the
  only event-ish stores.

### Schemas / validators / shared types

- Client-facing types: `types/index.ts` (`ListingCard`, `ListingDetail`,
  `CategorySummary`, …). Row→DTO mappers per domain: e.g. `features/listings/dto.ts`.
- Validation is mostly hand-rolled `typeof` checks; **Zod 4 is installed** and
  used where shapes are complex, scoped per domain (`features/submissions/validation.ts`).
  URL normalization helpers: `lib/server/url-normalize.ts`, `lib/server/url.ts`,
  `lib/server/slug.ts`.
- Domain code organization: `features/<domain>/` owns `data.ts` (Prisma reads),
  `dto.ts` (mappers), `*.ts` logic, and `*.test.ts` (node:test via `tsx`).
  Established domains: `features/listings`, `features/categories`,
  `features/submissions`, `features/saves`, `features/votes`.

### UI suitable for search results

- The homepage demo `components/home/crossing-home.tsx` already models the exact
  result vocabulary we need — `Result`, `SearchSet`, a results list, an
  inspector panel with score/verdict/tags/facts, and a two-item compare view.
  It is **mock/local data today**; it is the natural front-end to wire to the
  real engine.
- Shared kit: `components/ui/*` (Card with `tile|tall|wide|row` shapes, Badge,
  Button, Input), `components/layout/*`, `components/motion/*`.

---

## 2. Proposed architecture (modules)

Each pipeline stage becomes a small, independently testable module. Mapping:

| Stage | Module (proposed) | Nature |
|---|---|---|
| Query interpretation | `features/recommendation/query/interpret.ts` | AI-assisted, cached |
| Category definitions | `features/recommendation/categories/definitions.ts` | Static, typed |
| Category detection | `features/recommendation/categories/detect.ts` | Hybrid (rules → embeddings → LLM fallback) |
| Constraint extraction | `features/recommendation/query/constraints.ts` | Deterministic normalizers over interpreter output |
| Candidate discovery | `features/recommendation/candidates/discover.ts` | Deterministic (Postgres FTS over local corpus) |
| Entity resolution | `features/recommendation/entities/resolve.ts` | Deterministic (normalized key + aliases) |
| Evidence collection | `features/recommendation/evidence/collect.ts` | Cached snapshots; refreshed by background jobs |
| Review normalization | `features/recommendation/evidence/normalize.ts` | Deterministic |
| Ranking | `features/recommendation/ranking/score.ts` (+ `config.ts`) | **Pure, deterministic** |
| Explanation | `features/recommendation/explain/generate.ts` | AI-assisted, **constrained to supplied evidence** |
| Background refresh | `features/recommendation/jobs/*` + `app/api/cron/*` | Async |
| Caching | `features/recommendation/cache.ts` | Upstash + Postgres snapshots |
| Observability | `features/recommendation/observability.ts` | Wraps Sentry |

Design rules that make this safe:

- **`ranking/score.ts` is a pure function** modeled on `computeRankingScore`
  (`features/listings/ranking.ts`): same inputs → same output, no I/O, no LLM.
  The LLM may *interpret the query* and *word the explanation*, but the ordered
  result set is produced only by this function.
- **Query interpretation and explanation share one thin provider interface**
  (`features/recommendation/ai/provider.ts`) so the LLM vendor is swappable and
  can be stubbed in tests / Phase 1. See §7 cost/hallucination risks.
- **The explanation generator is fed only the evidence rows chosen by the
  deterministic ranker** and instructed to cite them; it cannot introduce new
  facts or reorder results.

---

## 3. Proposed folder structure

The example paths in the task brief use `src/lib/...`; **this repo has no `src/`
directory** and organizes product logic under top-level `features/<domain>/`
(`docs/architecture.md` §"Where future product domains belong"). Adapting to the
real convention, the engine is one new domain:

```
features/recommendation/
  index.ts                 # runRecommendation(input): orchestrates the pipeline
  types.ts                 # QueryIntent, Constraint, Candidate, ScoreBreakdown, Recommendation…
  data.ts                  # Prisma reads/writes for the new models (mirrors features/listings/data.ts)
  dto.ts                   # row → client DTO mappers (mirrors features/listings/dto.ts)
  cache.ts                 # cache keys + Upstash/Postgres snapshot read-through
  observability.ts         # withSpan()/log helpers over Sentry
  fixtures.ts              # Phase-1 mocked corpus + evidence (deterministic)

  query/
    schema.ts              # Zod schemas: QueryIntent, Constraint (Zod 4 already installed)
    interpret.ts           # LLM-assisted parse → QueryIntent (stub in Phase 1)
    constraints.ts         # deterministic constraint normalization/validation

  categories/
    definitions.ts         # typed registry of MVP categories + their attributes/weights
    detect.ts              # category detection (keyword → embedding → LLM fallback)

  candidates/
    discover.ts            # Postgres FTS candidate query over the entity corpus

  entities/
    resolve.ts             # dedup/canonicalize via normalized URL key + aliases

  evidence/
    collect.ts             # gather EvidenceSnapshot rows for candidates
    normalize.ts           # ratings/reviews → common 0–1 scale + topic buckets

  ranking/
    score.ts               # PURE deterministic scorer → ScoreBreakdown
    config.ts              # weights, per-category weighting profiles

  explain/
    generate.ts            # evidence-backed explanation (LLM constrained to evidence)
    schema.ts              # Zod schema for the explanation payload

  ai/
    provider.ts            # thin interface: complete()/embed(); test + real impls
    prompts.ts             # versioned prompt templates

  jobs/
    refresh-evidence.ts    # re-collect evidence snapshots (batch, like recomputeRankingScores)
    rebuild-embeddings.ts  # (Phase 3+) recompute entity/category embeddings

  __tests__ or *.test.ts   # colocated node:test files (repo convention)
```

New API + cron surface (colocated handlers, logic stays in `features/`):

```
app/api/recommend/route.ts            # POST { query } → RecommendationResult (public, rate-limited)
app/api/cron/refresh-evidence/route.ts # Vercel Cron target; guarded by CRON_SECRET
vercel.json                            # NEW: cron schedule(s) — none exists today
```

`app/api/listings/search/route.ts` stays as-is (keyword listing search). The
recommendation engine is additive, not a replacement, until it's proven.

---

## 4. Data flow (request lifecycle)

```
POST /api/recommend  { query: "best analytics tool for a small SaaS" }
──────────────────────────────────────────────────────────────────────
[sync]      DB_AVAILABLE guard → rate limit (Upstash) → parse body (Zod)
[cache]     cache.ts: hash(normalizedQuery) → look up cached RecommendationResult
              hit  → return immediately (＜50ms path)
              miss → continue
[AI/sync]   query/interpret.ts → QueryIntent   (LLM; result itself cached by query hash)
[sync]      categories/detect.ts → categoryId  (rules/embedding first, LLM only on ambiguity)
[sync]      query/constraints.ts → Constraint[] (deterministic normalization of intent)
[sync]      candidates/discover.ts → Candidate[] (Postgres FTS + category filter; read-only)
[sync]      entities/resolve.ts → canonical entities (normalized-URL key + aliases)
[cache]     evidence/collect.ts → EvidenceSnapshot[] read from DB
              (snapshots are pre-collected by background jobs, NOT fetched live here)
[sync]      evidence/normalize.ts → normalized ratings/topics (deterministic)
[DETERMINISTIC] ranking/score.ts → ordered candidates + ScoreBreakdown[]  (pure fn)
[AI/sync]   explain/generate.ts → explanation constrained to the chosen evidence
[sync]      persist QueryLog + Recommendation + RecommendationEvidence (audit/analytics)
[cache]     cache.ts: store RecommendationResult under the query hash (TTL)
[sync]      dto.ts → client shape → NextResponse.json
──────────────────────────────────────────────────────────────────────
[background / offline — never in the request path]
  jobs/refresh-evidence.ts   (Vercel Cron): re-collect evidence snapshots from
                             permitted sources into EvidenceSnapshot/Rating/Review
  recomputeRankingScores()   (existing): community-signal recompute for Listings
  jobs/rebuild-embeddings.ts (Phase 3+): category/entity embeddings for detection
```

Work classification:

- **Synchronous request work:** guards, rate limit, validation, candidate FTS
  query, entity resolution, evidence *read*, deterministic scoring, DTO mapping.
- **Cached work:** query→intent, query→result (Upstash short TTL); evidence
  snapshots (Postgres, refreshed offline).
- **Background jobs:** evidence collection/refresh, embedding rebuilds, ranking
  recompute. Never fetch third-party data inside `/api/recommend`.
- **AI-assisted work:** query interpretation, category detection fallback, and
  explanation wording — **never** candidate selection or final ordering.
- **Deterministic scoring work:** `ranking/score.ts` only.

---

## 5. Database plan

New models are **additive** and coexist with the existing discovery domain. Key
decision (assumption, flag for review): **reuse the existing `Category` model**
rather than inventing a second category table — it already has `slug`,
`position`, `isActive`, and relations. Category *behavior* (attributes, weight
profiles, detection keywords) lives in typed code
(`features/recommendation/categories/definitions.ts`), not a table.

Second decision (assumption): a new **`Entity`** is the recommendation unit and
links *optionally* 1:1 to a `Listing` via `Listing.websiteUrlKey`. This lets the
community catalog (`Listing`) and the engine corpus (`Entity`) converge without a
destructive migration — an `Entity` can exist for a tool nobody submitted yet,
and a `Listing` gains evidence when its key matches an `Entity`.

Proposed models (Prisma sketch — **illustrative only, not applied, no migration
written**; `prisma/schema.prisma` is unchanged by this doc):

```prisma
// Canonical recommendation unit. Optionally mirrors a Listing by normalized URL.
model Entity {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  websiteUrl    String
  websiteUrlKey String   @unique          // same normalization as Listing (lib/server/url-normalize.ts)
  categoryId    String
  category      Category @relation(fields: [categoryId], references: [id])
  listingId     String?  @unique          // optional bridge to the community catalog
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  aliases     EntityAlias[]
  sourceIds   ExternalSourceIdentity[]
  attributes  EntityAttribute[]
  snapshots   EvidenceSnapshot[]
  ratings     Rating[]
  reviews     Review[]
  scores      CandidateScore[]
  recEvidence RecommendationEvidence[]

  @@index([categoryId])
}

model EntityAlias {           // "Postgres", "PostgreSQL", "psql" → one Entity
  id       String @id @default(cuid())
  entityId String
  entity   Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  alias    String
  @@unique([entityId, alias])
  @@index([alias])
}

model ExternalSourceIdentity { // this Entity's id/URL on a permitted source
  id         String @id @default(cuid())
  entityId   String
  entity     Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  source     String            // "official" | "editorial" | "community" (see §7 — permitted only)
  externalId String
  url        String
  @@unique([source, externalId])
  @@index([entityId])
}

model EntityAttribute {        // structured, category-specific facts (price tier, has_free_plan…)
  id       String @id @default(cuid())
  entityId String
  entity   Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  key      String
  value    String
  numeric  Float?
  @@unique([entityId, key])
  @@index([key])
}

model EvidenceSnapshot {       // immutable point-in-time capture from one source
  id          String   @id @default(cuid())
  entityId    String
  entity      Entity   @relation(fields: [entityId], references: [id], onDelete: Cascade)
  source      String
  capturedAt  DateTime @default(now())
  payload     Json                        // raw normalized capture (not shown raw to clients)
  contentHash String                      // dedup identical captures
  @@index([entityId, capturedAt(sort: Desc)])
  @@unique([entityId, source, contentHash])
}

model Rating {                 // normalized numeric rating derived from a snapshot
  id         String @id @default(cuid())
  entityId   String
  entity     Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  source     String
  scoreRaw   Float
  scoreNorm  Float             // 0..1 (evidence/normalize.ts)
  sampleSize Int               // review volume behind the rating
  capturedAt DateTime @default(now())
  @@index([entityId])
}

model Review {                 // an individual normalized review excerpt (licensing-permitting)
  id         String @id @default(cuid())
  entityId   String
  entity     Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  source     String
  sentiment  Float?            // -1..1
  excerpt    String?           // stored only when licensing allows (see §7)
  createdAt  DateTime @default(now())
  topics     ReviewTopic[]
  @@index([entityId])
}

model ReviewTopic {            // extracted topic tag on a review ("performance", "support")
  id       String @id @default(cuid())
  reviewId String
  review   Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  topic    String
  polarity Float?
  @@index([topic])
}

model QueryLog {               // every incoming query (analytics + cache provenance)
  id          String   @id @default(cuid())
  rawQuery    String
  normalized  String            // used as the cache key basis
  userId      String?           // set only when requireAuth() succeeds; anonymous otherwise
  categoryId  String?
  createdAt   DateTime @default(now())
  constraints ParsedConstraint[]
  recommendations Recommendation[]
  @@index([normalized])
  @@index([createdAt(sort: Desc)])
}

model ParsedConstraint {       // structured constraint extracted from a query
  id       String  @id @default(cuid())
  queryId  String
  query    QueryLog @relation(fields: [queryId], references: [id], onDelete: Cascade)
  kind     String            // "budget" | "team_size" | "must_have" | "exclude" | …
  operator String            // "lte" | "eq" | "includes" | …
  value    String
  weight   Float   @default(1)
  @@index([queryId])
}

model CandidateScore {         // per-candidate deterministic score breakdown for one query
  id          String   @id @default(cuid())
  queryId     String
  entityId    String
  entity      Entity   @relation(fields: [entityId], references: [id])
  total       Float
  breakdown   Json               // component contributions (fit, quality, freshness, …)
  createdAt   DateTime @default(now())
  @@index([queryId])
  @@index([entityId])
}

model Recommendation {         // the chosen top result(s) for a query
  id        String   @id @default(cuid())
  queryId   String
  query     QueryLog @relation(fields: [queryId], references: [id], onDelete: Cascade)
  entityId  String
  rank      Int
  score     Float
  reason    String              // LLM wording, constrained to evidence
  createdAt DateTime @default(now())
  evidence  RecommendationEvidence[]
  @@index([queryId])
}

model RecommendationEvidence { // the exact evidence rows that justified a recommendation
  id               String @id @default(cuid())
  recommendationId String
  recommendation   Recommendation @relation(fields: [recommendationId], references: [id], onDelete: Cascade)
  entityId         String
  entity           Entity @relation(fields: [entityId], references: [id])
  kind             String        // "rating" | "review_topic" | "attribute"
  refId            String        // FK-by-id into Rating/ReviewTopic/EntityAttribute
  detail           String
  @@index([recommendationId])
}
```

Vector support (`pgvector`) is **deferred to Phase 3+** and intentionally *not*
in the sketch above. When added: enable via Prisma `postgresqlExtensions` preview
+ an `Unsupported("vector")` column on `Entity`/`Category`, in a dedicated
migration. MVP category detection does not need it (see §6).

Migration policy: **do not write a migration yet.** The repo has a clean
`prisma migrate` workflow (`prisma/migrations/`, `vercel-build` runs
`migrate deploy`), but Phase 1 is fully mocked (`fixtures.ts`) and needs no
schema change. The first migration lands in Phase 2, as a single additive
migration, reviewed on its own.

---

## 6. MVP scope

**Corpus: online tools & software only.** No restaurants, local businesses,
Yelp, or Google Maps.

Initial categories (seed in `features/recommendation/categories/definitions.ts`,
reusing the `Category` table for slugs/ordering):

- Developer tools
- AI tools
- Productivity tools
- Design tools
- Hosting platforms
- Email platforms
- Analytics tools

Why this scope fits the repo:

- Tools have **stable canonical URLs**, so `websiteUrlKey` normalization
  (`lib/server/url-normalize.ts`) already gives near-free entity resolution.
- Evidence for tools comes from **permitted, structured sources** (official
  pricing/feature pages, first-party docs, editorial roundups, and the
  platform's own community `Vote`/`Save` signals) — no review-site scraping
  needed to ship a credible MVP.
- Category detection over ~7 well-separated categories works with
  keyword/rules matching first; embeddings are an accuracy upgrade, not a
  prerequisite.

MVP category detection strategy (no AI dependency required to start):

1. Deterministic keyword/alias match against `definitions.ts`.
2. If ambiguous, embedding similarity (Phase 3).
3. If still ambiguous, single constrained LLM classification call (Phase 3),
   cached by query hash.

---

## 7. Risks

- **Legal / ToS:** Scraping review platforms violates their terms. Mitigation:
  MVP uses only official/first-party/editorial/community sources with permission;
  `ExternalSourceIdentity.source` is an allowlist enum, not "anything on the web."
- **Scraping fragility:** Any HTML capture breaks when sites change. Mitigation:
  evidence collection is background-only (`jobs/refresh-evidence.ts`), never in
  the request path; `EvidenceSnapshot` is immutable + hashed so a failed refresh
  degrades to stale-but-served, never a 500 (mirrors the fail-open ethos of
  `lib/server/rate-limit.ts`).
- **Review licensing:** Storing full third-party review text is often
  disallowed. Mitigation: `Review.excerpt` is nullable and populated only when a
  source's license permits; ratings/topics (derived aggregates) are stored
  instead of raw text where it doesn't.
- **Rate limits (ours & theirs):** `/api/recommend` must be throttled
  (`lib/server/rate-limit.ts`, e.g. reuse the `search:${ip}` budget). Outbound
  source fetches must be budgeted inside the cron job, not per user request.
- **Hallucinated explanations:** An LLM could invent reasons. Mitigation:
  `explain/generate.ts` receives *only* the `RecommendationEvidence` rows and is
  instructed to cite them; the response is validated against a Zod schema and
  every claim must map to a supplied evidence id, else it's dropped.
- **Entity collisions:** Two different tools sharing a name, or one tool with
  many URLs. Mitigation: canonical key is the normalized URL, not the name;
  `EntityAlias` absorbs name variants; ambiguous names never merge without a
  matching key.
- **Stale data:** Snapshots age. Mitigation: `capturedAt` on every snapshot; the
  UI can surface "as of" dates; refresh cadence is a cron schedule in `vercel.json`.
- **Ranking manipulation:** Community `Vote`/`Save` can be gamed. Mitigation:
  keep those as *one weighted input* among several (as `ranking-v0.md` already
  does with capped `editorialBoost`), not the whole score; deterministic scorer
  is auditable via `CandidateScore.breakdown`.
- **Cost:** LLM calls per query add up. Mitigation: cache query→intent and
  query→result (Upstash); interpretation is skippable for cache hits; Phase 1
  uses a stub provider (zero cost) to validate the whole flow first.
- **Privacy:** Query logs may contain personal intent. Mitigation: `QueryLog`
  stores `userId` only when authenticated; no IP is persisted in `QueryLog`
  (unlike `Session.ipHash`, which is scoped to auth); add a retention job.
- **New dependency risk:** an LLM SDK is the one significant new dependency.
  Justification is real (query interpretation + explanation) but it's gated
  behind `ai/provider.ts` so it can be stubbed, swapped, or deferred — and
  Phase 1 ships without it.

---

## 8. Implementation phases

Each phase is independently shippable and testable (`npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`).

**Phase 0 — this document.** Audit + plan. No code. ✅

**Phase 1 — mocked end-to-end flow (first implementation phase).**
Prove the whole pipeline with deterministic fixtures, zero external services,
zero schema changes.
- `features/recommendation/fixtures.ts`: a small hand-authored corpus of tools +
  evidence for 2–3 MVP categories.
- `query/interpret.ts` + `categories/detect.ts` + `constraints.ts` with a
  **stub AI provider** (`ai/provider.ts` test impl: rules-based intent, no
  network).
- `candidates/discover.ts`, `entities/resolve.ts`, `evidence/collect.ts`,
  `evidence/normalize.ts` reading from fixtures.
- `ranking/score.ts` — real pure scorer (unit-tested like
  `features/listings/ranking.test.ts`).
- `explain/generate.ts` with the stub provider (templated, evidence-cited).
- `app/api/recommend/route.ts` returning a real `RecommendationResult`.
- Wire `components/home/crossing-home.tsx` to hit the endpoint (behind a flag).
- Tests: pipeline snapshot test + scorer unit tests.

**Phase 2 — persistence.** One additive Prisma migration for the §5 models;
move fixtures into seeded rows (`prisma/seed.ts`); `data.ts`/`dto.ts` read from
Postgres; `QueryLog`/`Recommendation`/`CandidateScore` writes for audit.

**Phase 3 — real interpretation + retrieval.** Introduce the real LLM provider
behind `ai/provider.ts` (register its key in `lib/server/env-validation.ts`);
upgrade candidate discovery to Postgres FTS (`tsvector` + `websearch_to_tsquery`,
as `features/listings/search.ts` already anticipates); optionally add `pgvector`
for category detection.

**Phase 4 — evidence refresh jobs.** `jobs/refresh-evidence.ts` +
`app/api/cron/refresh-evidence/route.ts` + `vercel.json` schedule (guarded by a
`CRON_SECRET`), modeled on `recomputeRankingScores()`. Permitted sources only.

**Phase 5 — caching + observability hardening.** `cache.ts` read-through
(Upstash), `observability.ts` spans around each stage, cost/latency dashboards.

---

## Assumptions (flagged for review)

1. **Reuse `Category`** rather than a new category table (§5).
2. **New `Entity` optionally bridges to `Listing`** via `websiteUrlKey` rather
   than extending `Listing` in place (§5) — avoids a risky change to a shipped model.
3. **LLM vendor unspecified**; the plan hides it behind `ai/provider.ts`. Repo
   currently has no AI dependency, so adding one is a Phase-3 decision requiring
   sign-off; Phase 1 uses a stub.
4. **Vercel Cron** is the background-job mechanism (implied by Sentry
   `automaticVercelMonitors: true` and `ranking-v0.md`); a `vercel.json` must be
   added in Phase 4 (none exists today).
5. **`pgvector` is deferred**; MVP category detection is rules/keyword-first.

---

## Category-resolution gate (safety invariant)

Candidate retrieval is **gated** on category resolution. Before anything touches
the corpus, `resolveCategory()` (`features/recommendation/categories/resolve.ts`)
classifies the query into a `CategoryResolution`:

| `status` | meaning | pipeline behavior |
|---|---|---|
| `supported` | a known software category, confident enough (or user-selected) | retrieve + rank within that category only |
| `unsupported` | a recognized real-world domain we don't cover (local business, product, media…) | **no retrieval**; truthful "not covered yet" response |
| `ambiguous` | a weak/short keyword hit below `CATEGORY_CONFIDENCE_THRESHOLD` | **no retrieval**; ask the user to pick a category |
| `unknown` | nothing recognizable | **no retrieval**; offer the category picker |

Only `supported` proceeds. There is deliberately **no** "null category → all
categories", "empty filter → whole corpus", or "parser failure → rank seeds"
fallback anywhere — those paths caused a local "coffee shop" query to be ranked
against seeded software. `discoverCandidates()` requires a resolved category id
and filters strictly by it; `invariant()` checks (`features/recommendation/invariant.ts`)
assert no cross-category leakage and fail loudly in development. Cross-category
search is not part of this MVP.

An explicit user selection (`overrides.categoryId`, surfaced in the UI as the
category picker) always resolves to `supported` for that category — the only way
to search a category the query text didn't name.

## API response contract (discriminated union)

`/api/recommend` never assumes success. `searchRecommendations()` returns a
`SearchResponse` discriminated on `status`:

| `status` | HTTP | carries |
|---|---|---|
| `success` | 200 | `bestMatch`, `alternatives`, `bestMatchClaims`, `confidence`, `warnings` |
| `unsupported-category` | 200 | `category` (resolution), `message` — no candidates |
| `needs-clarification` | 200 | `suggestions[]`, `message` — no candidates |
| `no-results` | 200 | `ineligibleCount`, `message` — supported category, nothing eligible |
| `error` | 500 / 503 | `code` (`internal_error` / `seeded_data_unavailable`), `message` |

The UI (`components/search/search-experience.tsx`) renders each state with its
own component; `deriveViewState()` is a direct projection of `status`. A fake
"empty winner" is never fabricated to satisfy the type.

**Diagnostics (Part 9).** Every result carries a `RecommendationDiagnostics`
trace (resolved domain/category/status, confidence, candidate count + category
ids, whether ranking ran, final state). The API attaches it to the response and
logs it **only in development**; production logs a minimal, query-free line and
the response omits `diagnostics` entirely. Nothing internal is exposed in the
production UI.
