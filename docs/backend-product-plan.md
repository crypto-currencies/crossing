# Backend product plan

Audit of what exists, the domain models Crossing still needs, and the order to
build them. Written for the backend track; the frontend agent owns presentation.

---

## 1. Current architecture

### Identity
- `User` (cuid, `email?`, `name?`, `image?`, `role: UserRole`, `suspendedAt?`).
- `UserRole = USER | MODERATOR | ADMIN | OWNER` — a single **global** role.
- `Account` / `Session` / `VerificationToken` (NextAuth-compatible) plus a custom
  DB session behind an httpOnly `session_token` cookie.
- Google OAuth (NextAuth v4, JWT strategy) → `/oauth-callback` → `/api/auth/google-token`
  mints the DB session. Owner bootstrap by `OWNER_EMAIL` in `lib/server/admin.ts`.
- Authorization helpers: `userHasRole`, `isAdmin`, `isOwner` (`lib/server/auth.ts`),
  `requireAdminApi`, `requireOwnerApi`, `getAdminUser`, `writeAuditLog`.

### Two parallel catalogs (the central architectural problem)
1. **Legacy directory (in Postgres):** `Category` → `Listing` (+ `Save`, `Vote`,
   `Submission`). Community-submitted sites with `websiteUrlKey` uniqueness,
   denormalized `saveCount`/`voteCount`/`rankingScore`, and a
   `PENDING/APPROVED/REJECTED` submission flow. Modules: `features/listings`,
   `features/saves`, `features/votes`, `features/submissions`.
2. **Recommendation corpus (in memory):** `features/recommendation/fixtures.ts`
   builds ~17 **fictional** `Entity` objects with string ids (`tally-metrics`),
   code-defined categories (`analytics-tools`), attributes, and evidence.

These do not reference each other. `Save` saves a `Listing`; the recommender
ranks an `Entity`. **Nothing a user can search is saveable, and nothing saveable
is searchable.** Resolving this is the highest-value backend work.

### Evidence
- `EvidenceSnapshot` (Postgres, append-only, unique `(entityId, contentFingerprint)`)
  — real, migrated, and populated for 3 pilot vendors. `entityId` is a **string**,
  not a foreign key, because entities live in fixtures.
- `features/ingestion/*` — approved-domain registry, SSRF-safe fetcher, robots
  policy, extraction, pricing normalization, snapshot store (memory/file/Prisma),
  merge gating, readiness verdicts.

### Recommendation engine
- Deterministic: category gate → category-scoped retrieval → hard-constraint
  eligibility → weighted scoring → explanation input. `runRecommendation` in
  `features/recommendation/recommend.ts`. **Ranking logic must not change.**
- Candidate retrieval today: `discoverCandidates(categoryId, corpus)` filtering a
  fixture array.

### Conventions
- Zod for input validation; typed DTOs in `features/*/dto.ts`.
- API routes in `app/api/**/route.ts`, `NextResponse.json`, `{ error: "code" }`.
- Rate limiting: `rateLimit(key, max, windowMs)` (Upstash, **fails open**).
- Audit: `writeAuditLog`, `writeSecurityEvent`.
- Email: `lib/email.ts` (Resend) + `lib/email-templates.ts`.
- Uploads: `lib/server/storage.ts` (Vercel Blob).
- Jobs: Vercel Cron → `/api/cron/refresh-evidence` guarded by `CRON_SECRET`.
- Env validated at boot by `lib/server/env-validation.ts`.

### Missing entirely
Business/organization concept · listing claims · saved **entities** and
collections · unified contribution pipeline · canonical DB entities · search
history/analytics events · structured feedback storage · journal content ·
versioned legal documents · moderation queues · local-discovery domain.

---

## 2. Target model relationships

```
User ─┬─ BusinessMembership ─── Business ─── ListingClaim ─── Entity
      ├─ SavedItem ─── Entity           │                        │
      ├─ Collection ─── CollectionItem ─┘                   EvidenceSnapshot
      ├─ Contribution (unified submissions)  ── targets ── Entity?
      ├─ SearchEvent / RecommendationFeedback
      └─ JournalPost (author)

Entity ─┬─ EntityAlias
        ├─ EntityExternalId
        └─ listingId? ── Listing   (bridge to the legacy directory)
```

**Key decisions**

1. **One identity.** No separate business auth. `User` is unchanged; business
   capability = rows in `BusinessMembership`. A person can be a consumer and a
   business member simultaneously. Global `UserRole` and per-business
   `BusinessRole` are **separate axes** and must never be conflated.
2. **New `Entity` model rather than extending `Listing`.** `Listing` is shipped
   and carries community semantics (votes, ranking score, editorial boost).
   `Entity` is the recommendation unit with its own status lifecycle and
   evidence. They bridge optionally via `Entity.listingId` / `websiteUrlKey`.
   This avoids a risky migration of a live model and keeps category leakage
   impossible (entity category ids stay code-defined strings).
3. **Fictional data never reaches production.** `Entity.source` distinguishes
   `CANONICAL` from `DEMO`; the production repository filters to
   `status = ACTIVE AND source = CANONICAL`. Fixtures stay for hermetic tests.
4. **Businesses never write ranking.** Business edits become `Contribution`
   rows requiring moderation; independent signals (score, confidence, feedback)
   are Crossing-controlled and have no business-writable path.

---

## 3. Permission model

| Axis | Values | Source of truth |
|---|---|---|
| Global | `USER < MODERATOR < ADMIN < OWNER` | `User.role` (fresh DB read) |
| Per-business | `ANALYST < BILLING < EDITOR < ADMIN < OWNER` | `BusinessMembership.role` |

Rules:
- Authorization **never** trusts a client-supplied role; every check re-reads the
  DB (`requireAdminApi` already does this).
- Global `ADMIN`/`OWNER` may moderate any business but is **not** implicitly a
  business member — cross-business admin actions are audit-logged.
- Business roles grant only that business's resources. Owning a business never
  widens global privileges.
- Last-owner protection: a business must always retain ≥1 `OWNER` membership.

---

## 4. State machines

**Contribution** (unified submissions):
`DRAFT → SUBMITTED → UNDER_REVIEW → {NEEDS_INFORMATION → UNDER_REVIEW} → APPROVED | REJECTED`,
plus `WITHDRAWN` from any pre-decision state. Terminal: `APPROVED`, `REJECTED`,
`WITHDRAWN`. Only a moderator may reach `APPROVED`/`REJECTED`; only the submitter
may `WITHDRAW`. Every transition writes a `ContributionEvent` (actor, from, to,
note) — the audit trail.

**ListingClaim:**
`STARTED → {EMAIL_VERIFICATION_PENDING | DOMAIN_VERIFICATION_PENDING | DOCUMENT_REVIEW_PENDING} → APPROVED | REJECTED`,
and `APPROVED → REVOKED`. Tokens are single-use, hashed at rest, and expire.

**Entity:** `DRAFT → ACTIVE → {HIDDEN | ARCHIVED | CLOSED}`; only `ACTIVE` is
retrievable for production ranking.

**JournalPost:** `DRAFT → SCHEDULED → PUBLISHED → ARCHIVED`.

**LegalDocument:** `DRAFT → PUBLISHED` (immutable once published; a change means
a new version row).

---

## 5. API boundaries

- `/api/saved/*` — consumer saves + collections (auth required).
- `/api/contributions/*` — create/list/withdraw; moderator transitions under
  `/api/admin/contributions/*`.
- `/api/browse/*`, `/api/discover` — read-only, cacheable, typed contracts.
- `/api/recommend` — unchanged contract; retrieval swapped underneath.
- `/api/business/*` — profile, memberships, invitations, claims, analytics.
- `/api/admin/*` — moderation queues, entity administration.
- `/api/journal/*`, `/api/legal/*` — published content only, publicly readable.

All mutations: auth → authz → Zod → transaction → audit → typed result. Failures
never return `200`; raw Prisma errors are never surfaced (`lib/server/api-result.ts`).

---

## 6. Migration sequence

1. **`add_product_domain`** (this phase) — additive only: `Entity`,
   `EntityAlias`, `EntityExternalId`, `Business`, `BusinessMembership`,
   `BusinessInvitation`, `ListingClaim`, `SavedItem`, `Collection`,
   `CollectionItem`, `Contribution`, `ContributionEvent`, `SearchEvent`,
   `RecommendationFeedback`, `JournalPost`, `LegalDocument` + enums.
   No existing table is altered or dropped.
2. **Backfill** — seed canonical `Entity` rows for the approved pilots
   (Fathom, Matomo `ACTIVE`; Plausible `DRAFT` pending evidence readiness).
   Idempotent script, safe to re-run.
3. **`link_evidence_entity`** (later) — add a real FK from `EvidenceSnapshot`
   to `Entity` once every snapshot `entityId` resolves. Must not run before the
   backfill.
4. **`business_billing`** (later) — promotion/billing, once terms exist.

Rollback: every table in step 1 is new and unreferenced by existing code paths,
so `DROP TABLE` in reverse dependency order is a clean rollback. Feature flags
mean an un-migrated deploy simply keeps features off.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Fictional entities leaking into production results | `source = CANONICAL` + `status = ACTIVE` filter, enforced in the repository and asserted by tests |
| Two catalogs drifting | `Entity.listingId` bridge + `websiteUrlKey` normalization; no auto-merge |
| Business overwriting independent signals | No business-writable path to score/confidence/feedback; edits go through `Contribution` |
| Rate limiter fails open (Upstash absent) | Documented; add a DB-backed fallback counter for destructive endpoints |
| Search history privacy | Retention policy + `k`-anonymity threshold for aggregates + user-clearable history |
| Claim spoofing | Hashed single-use tokens, expiry, replay protection, audit log, moderator override |
| Large schema in one migration | Additive only; each model independently feature-flagged |

---

## 8. Implementation phases

- **P1 (this phase)** — schema + migration, feature flags, result/error contracts,
  authorization helpers (global + business), saved items (full vertical),
  production entity repository with demo isolation, local-discovery
  architecture + contracts, tests.
- **P2** — contribution APIs + moderation queues + email notifications.
- **P3** — business onboarding, claim verification (email + DNS + file token),
  team management.
- **P4** — browse/discover read APIs backed by real counts; search events.
- **P5** — business analytics (real events only, k-thresholded), journal +
  legal publishing APIs.
- **P6** — local-discovery provider adapter, only after owner supplies
  credentials and approves the provider's terms.

---

## 9. Feature flags

All default **off**. `lib/server/feature-flags.ts`.

| Flag | Gates |
|---|---|
| `FEATURE_SAVED_ITEMS` | saved items + collections APIs |
| `FEATURE_CONTRIBUTIONS` | contribution submission + moderation |
| `FEATURE_BUSINESS_ONBOARDING` | business creation + membership |
| `FEATURE_BUSINESS_CLAIMS` | listing claim workflow |
| `FEATURE_LOCAL_DISCOVERY` | local category gating + provider adapter |
| `FEATURE_JOURNAL_PUBLISHING` | journal write/publish APIs |
| `FEATURE_DB_ENTITIES` | DB-backed candidate retrieval (vs fixtures) |

---

## 10. Data retention assumptions (to be confirmed by the owner)

- `SearchEvent.rawQuery` retained **90 days**, then nulled (aggregates persist).
- Aggregates require **k ≥ 5** distinct users before exposure.
- Users may clear their own history at any time; clearing removes personal rows,
  not already-computed anonymous aggregates.
- Location input is never persisted beyond the request unless the user opts in.
- No search text is ever attached to advertising or shared with third parties.
