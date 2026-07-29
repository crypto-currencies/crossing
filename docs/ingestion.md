# Evidence ingestion (official-site adapter)

The first real evidence source: controlled, factual ingestion from a manually
approved set of **official software websites**. It normalizes verifiable facts
into Crossing's evidence model, stores versioned snapshots, and — opt-in —
overlays them onto the seeded corpus for ranking. It never crawls the open web,
never scrapes reviews, and never runs during a search.

All code lives under `features/ingestion/`. Server-only.

## What it does / does not do

- ✅ Fetches only URLs in the approved-domain registry (`registry.ts`).
- ✅ SSRF-safe fetching, robots-respecting, size/time/redirect capped.
- ✅ Extracts structured facts (JSON-LD → metadata → semantic → fallback) with provenance.
- ✅ Cautious pricing normalization; unknown when not defensible.
- ✅ Append-only, fingerprinted, versioned snapshots.
- ❌ No Trustpilot/Yelp/Google/Reddit/GitHub, no search-engine discovery, no crawling arbitrary or user-supplied URLs.
- ❌ No browser automation, no JS execution, no bypassing bot protection / logins / CAPTCHAs.
- ❌ No ratings from official sites; no fabricated prices or features; no synchronous crawling during search.

## Crawler identity

`User-Agent: CrossingBot/0.1 (+https://crossing.dev/bot; evidence ingestion; contact: bot@crossing.dev)`.
Conservative cadence (≥1s between requests to an origin, or the robots `Crawl-delay`, whichever is larger).

## Approving a new domain

Edit `features/ingestion/registry.ts` and add an `ApprovedEntitySource`:

- `entityId` (must match a `features/recommendation/fixtures.ts` entity), `canonicalName`, `canonicalDomain`, `categoryId`
- `approvedOrigins` (scheme + host [+ port]), `homepageUrl`, optional `pricingUrl` / `docsUrl` / `featuresUrl`
- `allowedCrawlDepth` (0 this phase), `allowedPageCount`, `allowSubdomains?`, `allowOffOriginRedirect?`, `enabled`

`validateRegistry()` (run by a test) rejects malformed entries. Arbitrary or
user-supplied URLs can **never** enter ingestion — only registry entries, and
only URLs that fall within their `approvedOrigins`.

## How ingestion works

`registry` → `robots` (fail-closed) → `fetcher` (SSRF + policy) → `extract` →
`pricing` → `evidence` (normalize) → `snapshot` → `store` (append-only). The
`officialSiteAdapter` (`adapter.ts`) performs one entity → one snapshot; the
`service.ts` orchestrates skip-fresh / dedup / partial-failure across entities.

## Crawl & robots policy

`robots.ts` fetches `/robots.txt`, evaluates the `CrossingBot` (else `*`) group,
and matches paths by longest rule (Allow wins ties). **Fail-closed:** a 5xx or
unreachable robots.txt → `undetermined` → ingestion stops for that origin. A 404
→ no robots.txt → permitted.

## Security boundaries

`ssrf.ts` blocks loopback / private (RFC1918) / link-local (incl. the cloud
metadata IP) / CGNAT / ULA / documentation / multicast / reserved ranges for
IPv4, IPv6, and IPv4-mapped IPv6. `fetcher.ts` re-validates the origin and
resolves + checks DNS on **every** hop, caps redirects/size(decoded)/time,
allowlists content-types, and rejects redirects leaving the approved origin.
**Known limitation:** DNS is validated then the request connects by hostname —
all resolved records must be public, but a pin-to-IP connection (fully closing
the resolve→connect rebinding race) is future work.

## Evidence provenance

Every fact carries `{ method (json-ld|meta|semantic|fallback), sourceUrl,
sourceText (short excerpt), confidence, fingerprint }`. Marketing superlatives
("best", "fastest", "most trusted") are treated as copy, not facts. Supporting
text is a constrained, plain-text excerpt — never raw HTML (rendered escaped by
React in the audit UI).

## Snapshot retention

Snapshots are **append-only** (`store.ts`): a refresh writes a new snapshot;
history is never overwritten. We store hashes + short excerpts, **not** full raw
HTML. Dedup: an identical `contentFingerprint` to the latest good snapshot is
recorded as `deduplicated` and not re-appended. Stores: `InMemorySnapshotStore`
(tests / fixture engine) and `FileSnapshotStore` (`.data/ingestion/*.jsonl`, dev
persistence). **Production path:** a Prisma `EvidenceSnapshot` table implementing
`SnapshotStore` (not wired this phase, to avoid coupling the fixture engine to
Postgres).

## How official evidence enters ranking

`merge.ts` overlays fresh, confident official FACTUAL attributes
(`hasFreePlan`, `priceMonthly`, `platforms`) onto a seeded entity:

- Recent official evidence generally **outranks** the seed value; conflicts
  produce warnings, never silent overwrites.
- Stale or low-confidence (< `MIN_OVERLAY_CONFIDENCE`) official evidence keeps
  the seed value.
- Missing official data never means "feature absent" — the seed value stays.
- Official evidence never becomes a rating / review-quality signal.

Enrichment is **opt-in**: set `INGESTION_MERGE=on`. Off by default, so the
validated seeded ranking is unchanged. When on, `runRecommendation` reads the
snapshot store (no crawling) and records an `evidenceMode` in dev diagnostics.

### Mock/live isolation

Evidence mode per entity: `seeded` (no live facts), `mixed` (some), `live` (all
critical factual fields official-backed). The production data-mode guard is
unchanged. The evidence-audit tool is the development-visible indicator.

## Triggering ingestion

Never public. Development-first; disabled in production unless
`INGESTION_ALLOW_PROD=true`, and then ADMIN/OWNER only.

- **CLI:** `npm run ingest -- --all --dry-run` · `--entity <id>` · `--category <id>` · `--force`
- **API:** `POST /api/admin/ingestion` `{ scope: "entity"|"category"|"all", target?, dryRun?, force? }`
- **Audit UI:** `/control/admin/evidence` (list + filters) and `/control/admin/evidence/[entityId]` (detail), each with Dry-run / Refresh actions. `noindex`.

## Observability

`service.ts` emits one structured, log-safe line per entity: jobId, entityId,
adapterId, urlsAttempted/Blocked, robots status, fetch duration, bytes,
pages ok/failed, snapshot outcome, warnings, error classification. No secrets,
no page bodies.

## Implementing a future adapter

Implement `SourceAdapter` (`adapter.ts`): `validateConfig`, `run` (fetch +
extract within policy → one `EvidenceSnapshot`), and declare `attribution`.
Reuse `fetcher`/`robots`/`snapshot`/`store`. Register it and let `service.ts`
orchestrate it. Do not add empty stubs before an adapter is real.

## Known limitations

- Registry domains mirror the fictional seed fixtures, so live dev ingestion
  fails DNS (surfaced in the audit tool). Tests use local HTML fixtures.
- DNS-rebinding is mitigated (all records validated) but not fully pinned.
- Regex-based extraction (no HTML-parser dependency) targets controlled,
  well-formed metadata; exotic markup may extract less.
- Snapshot store is file/in-memory this phase; Postgres is the production path.

---

# Phase 3 — real-domain pilot, persistence, scheduled refresh

## Pilot entities (analytics-tools)

The fictional seeds are DISABLED for ingestion (`enabled:false` in registry.ts);
they remain demo-only ranking data and are never presented as, or merged with, a
real vendor. Three real analytics vendors are the ONLY enabled sources
(`features/ingestion/pilot.ts` documents the seed↔real mapping):

| Entity id | Vendor | Domain | Pages configured |
|---|---|---|---|
| `plausible-analytics` | Plausible Analytics | plausible.io | `/`, `/docs` |
| `fathom-analytics` | Fathom Analytics | usefathom.com | `/`, `/pricing` |
| `matomo` | Matomo | matomo.org | `/`, `/pricing/` |

Live dry-run robots results (verified via the policy layer, fail-closed):
Plausible → `no_robots` (404 → permitted); Fathom → `rules` (allowed);
Matomo → `rules` (allowed). No configured URL was disallowed.

## Prisma persistence

Model `EvidenceSnapshot` (append-only) with a unique `(entityId,
contentFingerprint)` dedup index and indexes on `entityId`, `adapterId`,
`retrievedAt`, `contentFingerprint`, and `(entityId, ok, retrievedAt)` for
latest-valid lookup. No raw HTML is stored — only hashes + constrained excerpts.
`PrismaSnapshotStore` implements the `SnapshotStore` interface.

**Store selection** (`resolveStoreKind`): `INGESTION_STORE=memory|file|prisma`
wins; otherwise production → `prisma` (throws if `DATABASE_URL` is missing — no
silent filesystem fallback), development → `file` (`.data/ingestion`).

**Migration** `20260724000000_add_evidence_snapshot` — additive only (creates one
table + its indexes; touches no existing model). Applied by the existing
`vercel-build` = `prisma migrate deploy` workflow. Rollback: `DROP TABLE
"EvidenceSnapshot"` (no other object depends on it). Requires `DATABASE_URL`.

## Scheduled refresh

`vercel.json` schedules `GET /api/cron/refresh-evidence` daily at 06:00 UTC.
Guarded by `CRON_SECRET` (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
no secret configured → the route refuses). It reuses the ingestion service (no
duplicate crawl logic), refreshes only ENABLED sources, skips fresh evidence,
respects robots + cadence, isolates per-entity failures, is time-bounded, and
paginates deterministically via `selectRefreshBatch` (`?cursor=`).

Config env: `INGESTION_REFRESH_BATCH` (default 5), `INGESTION_REFRESH_MAX_MS`
(50000), `INGESTION_REFRESH_STALE_MS` (7 days), `INGESTION_REFRESH_CATEGORIES`,
`INGESTION_REFRESH_RETRY_FAILED`.

## Category/entity-scoped merge

`INGESTION_MERGE=on` (global) is discouraged. Prefer
`INGESTION_MERGE_CATEGORIES=analytics-tools` or
`INGESTION_MERGE_ENTITIES=fathom-analytics,matomo`. An entity's official facts
enter ranking only when allow-listed AND its readiness verdict is `ready`/`mixed`
(fresh, confident, no blocking conflict, category matches, ≥1 official URL
succeeded). Unready entities keep seeded values and a diagnostics warning; only
verified factual attributes (`priceMonthly`, `hasFreePlan`, `platforms`) are ever
replaced. Ratings/reviews/sentiment are never created or replaced.

## Readiness verdicts (deterministic — readiness.ts)

`not-ingested` · `ingestion-failed` · `stale` · `blocked-by-conflict` ·
`needs-review` (low confidence) · `mixed` (partial official coverage) · `ready`
(platform fact + pricing fact, fresh, confident, no conflict). Shown per entity
in the audit UI (`/control/admin/evidence`).

## Required environment variables (this phase)

`DATABASE_URL` (Prisma store + migration), `CRON_SECRET` (scheduled refresh).
Optional: `INGESTION_STORE`, the `INGESTION_MERGE_*` and `INGESTION_REFRESH_*`
knobs above, `INGESTION_ALLOW_PROD` (admin tool in prod).
