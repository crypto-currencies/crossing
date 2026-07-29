# Crossing.dev — Security & Product-Integrity Audit

**Date:** 2026-07-28 · **Scope:** full repository at `main` · **Type:** read-only audit

> This is an audit, not a clearance. It documents what was inspected, what was
> found, and what could not be verified. **No claim is made that the application
> is secure.** Several areas are explicitly marked as not fully testable.

---

## Executive summary

### Overall posture

The codebase is **notably stronger than typical for its stage** on the classes of
bug that usually dominate an audit like this. There is **zero** use of
`dangerouslySetInnerHTML`, `eval`, `new Function`, `child_process`, or raw SQL
anywhere in application code. Prisma is used exclusively through its typed query
API, Zod validates the public mutation boundaries, and the SSRF module is the
most rigorous component in the repository.

The weaknesses cluster in three places, and they share a shape: **security
controls that exist but are not uniformly applied, or that fail open.**

1. **Lifecycle enforcement gaps** — suspension does not revoke sessions, and
   `isSuspended` is checked route-by-route rather than centrally.
2. **Fail-open and inverted-default guards** — rate limiting fails open, CSP is
   report-only by default, and one debug route's guard is inverted.
3. **Dependency exposure** — `next-auth` and `next` both carry advisories that
   are reachable in this application.

### Findings by severity

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 9 |
| LOW | 6 |
| INFORMATIONAL | 4 |
| **Total** | **23** |

No finding met the CRITICAL bar (admin takeover, arbitrary account takeover,
RCE, database compromise, practically-exploitable secret exposure, cross-tenant
mass data exposure, or SSRF to internal infrastructure). Severity has
deliberately **not** been inflated — see §Severity calibration.

### Most urgent risks

1. **SEC-001** — `next-auth` ≤4.24.14 OAuth cookie-binding and email-normalizer advisories.
2. **SEC-002** — Suspending an account does not terminate its existing sessions (up to 30 days of retained access).
3. **SEC-003** — `prisma/seed.ts` has no production guard, contains a hardcoded password, and fabricates engagement metrics.
4. **SEC-004** — `next` ≤16.3.0-preview.7 advisories including SSRF-in-rewrites and cache confusion.
5. **SEC-006** — `/api/sentry-test` guard is inverted; publicly triggerable in production when the secret is unset.

### Major strengths

Verified in code, not assumed — see §Positive controls for file references.
SSRF defense (DNS-resolution-based, per-hop redirect revalidation), password
reset (hashed single-use tokens), boot-time environment validation, DB-backed
sessions (roles are always fresh — no stale-JWT class of bug), the centralized
`/api/saved/*` guard, category gating, deterministic ranking, and the
official-vs-independent evidence separation.

### Areas not fully testable

- **All 30 database-integration tests are skipped** in this environment,
  including every cross-user isolation test (SEC-012). Tenant isolation is
  therefore **asserted by code reading, not verified by execution.**
- No staging deployment was exercised: cookie flags, CSP behavior, and header
  delivery were read from configuration, not observed on the wire.
- No live provider credentials, so review/search provider paths were exercised
  only against stubs.
- Dependency reachability was assessed by inspection, not by exploitation.

### Production launch recommendation

**Not ready for public production launch.** Resolve P0 and P1 first. The
blocking items are small in number and mostly low-complexity — this is a
"finish the hardening" gap, not a structural one. A private/invite beta with
P0 complete would be defensible.

---

## Severity calibration

Two findings carry npm-reported severities higher than assigned here, and the
reasoning is stated rather than hidden:

- **`next-auth` is npm-CRITICAL**, assigned **HIGH**. The provider-binding
  advisory (GHSA-x445-f3h2-j279) requires ≥2 OAuth providers to be meaningfully
  exploitable; this app configures only Google. Session management is also
  **not** delegated to next-auth — the app runs its own DB-backed sessions
  (`lib/server/auth.ts`), so the blast radius is the OAuth handshake, not the
  session layer.
- Conversely, **SEC-003 is rated HIGH despite being "just a seed script"**,
  because the failure mode is a known-password account in a production database.

---

# Part 1 — Repository map & trust boundaries

## Inventory

| Area | Location | Notes |
|---|---|---|
| API routes | `app/api/**/route.ts` | **51 routes** |
| Middleware | `proxy.ts` | Cookie-presence gate only; no role check |
| Auth core | `lib/server/auth.ts` (294 ln) | Custom DB-backed sessions + scrypt |
| OAuth | `lib/auth-google.ts`, `app/api/auth/[...nextauth]/` | Google only |
| Redirect safety | `lib/auth-redirect.ts` | `safeInternalPath`, `isProtectedPath` |
| Admin helpers | `lib/server/admin.ts` | `requireOwnerApi`, `writeAuditLog` |
| Rate limiting | `lib/server/rate-limit.ts` | Upstash; **fails open** |
| Env validation | `lib/server/env-validation.ts` → `instrumentation.ts` | Enforced at boot |
| Schema | `prisma/schema.prisma` | Valid; migrations non-destructive |
| Search pipeline | `features/search/**` | Discovery → resolution → evidence → ranking |
| Ingestion/crawler | `features/ingestion/**` | SSRF, robots, snapshots |
| Reviews | `features/search/reviews/**` | Trustpilot adapter + terms registry |
| Cron | `app/api/cron/refresh-evidence/` | `CRON_SECRET` |
| Uploads | `app/api/upload/`, `lib/server/storage.ts` | Vercel Blob client tokens |
| Headers/CSP | `next.config.ts` | CSP **report-only** by default |
| Seed | `prisma/seed.ts` | **No production guard** |

**Server actions: none.** `grep -rl "use server"` returns no matches. All
mutations flow through API routes, which narrows the audit surface considerably
and is a deliberate strength.

## Trust boundaries

```
[1] Browser ──────────────► App          cookie/bearer; proxy.ts gates presence only
[2] App ──────────────────► Postgres     Prisma typed API; no raw SQL
[3] App ──────────────────► Search APIs  provider-agnostic; budgeted
[4] App ──────────────────► Crawler      SSRF-guarded, allowlisted  ★ strongest
[5] Cron ─────────────────► Ingestion    CRON_SECRET; no concurrency lock
[6] User ─────────────────► Other users  Prisma where-clause scoping (tests skipped)
[7] Submission ───────────► Moderation   admin-gated
[8] Provider evidence ────► Ranking      independence-enforced  ★ strong
[9] App ──────────────────► Blob storage client tokens, server-issued
```

## Abuse cases

| # | Actor | Abuse case | Finding |
|---|---|---|---|
| A1 | Suspended user | Continues using retained session | SEC-002 |
| A2 | Unauthenticated | Floods Sentry via debug route | SEC-006 |
| A3 | Unauthenticated | Burns provider budget via `/api/recommend` | SEC-009 |
| A4 | Authenticated | Unlimited blob tokens | SEC-011 |
| A5 | Network observer | Reads `CRON_SECRET` from logs | SEC-007 |
| A6 | Attacker w/ URL | SSRF via crawler | **Mitigated** — PC-01 |
| A7 | Malicious site | Prompt-injects the discovery agent | **Mitigated** — PC-08 |
| A8 | Vendor | Passes testimonials as reviews | **Mitigated** — PC-09 |
| A9 | Operator error | Seeds prod, creates known-password account | SEC-003 |
| A10 | User off-Vercel | Spoofs `x-forwarded-for` to evade limits | SEC-016 |

---

# Findings

---

```text
ID:                 SEC-001
Title:              next-auth ≤4.24.14 — OAuth cookie-binding and email-normalizer advisories
Severity:           HIGH
Confidence:         CONFIRMED
Category:           Dependency / Authentication
Affected files:     package.json ("next-auth": "^4.24.11")
                    app/api/auth/[...nextauth]/route.ts
                    lib/auth-google.ts
Affected routes:    /api/auth/[...nextauth], Google OAuth callback
```

**Description.** `npm audit --omit=dev` reports next-auth at CRITICAL with three
advisories: OAuth `state`/`nonce`/PKCE cookies not bound to the issuing provider
(GHSA-x445-f3h2-j279); the email normalizer validating before Unicode
normalization, permitting a homoglyph `@` bypass (GHSA-7rqj-j65f-68wh); and an
uncaught exception in `getToken()` on malformed Bearer headers
(GHSA-xmf8-cvqr-rfgj).

**Attack scenario.** The homoglyph advisory is the most relevant here: an
attacker registers an address whose `@` is a Unicode homoglyph, which passes
validation pre-normalization and then normalizes into a different address —
potentially colliding with an existing account during linking.

**Impact.** Account-linking confusion; DoS on malformed Bearer headers. The
provider-binding issue needs ≥2 providers to be meaningfully exploitable, and
only Google is configured.

**Evidence.** `npm audit --omit=dev --json` → `next-auth  <=4.24.14  direct=true`.

**Existing protections.** Only one OAuth provider. Sessions are **not** delegated
to next-auth — `lib/server/auth.ts` runs independent DB-backed sessions, so the
session layer is unaffected. `createSession` gates suspended accounts.

**Recommended remediation.** Upgrade next-auth to a patched 4.x. Verify the
Google callback and `/oauth-callback` bridge still function. Do not migrate to
Auth.js v5 as part of this fix.

**Fix complexity:** LOW · **Regression risk:** MEDIUM (auth path)
**Suggested tests:** Existing `lib/auth-google.test.ts`; add a homoglyph-email
registration test.

---

```text
ID:                 SEC-002
Title:              Suspending an account does not terminate its existing sessions
Severity:           HIGH
Confidence:         CONFIRMED
Category:           Broken access control / Session management
Affected files:     app/api/admin/users/[id]/status/route.ts:52-58
                    lib/server/auth.ts:145-171 (validateSession)
Affected routes:    PATCH /api/admin/users/[id]/status; all authenticated routes
```

**Description.** Suspension writes `suspendedAt` but issues no session
revocation. `validateSession()` — the single chokepoint every authenticated
request passes through — loads the session and returns `session.user` **without
consulting `suspendedAt`**. Sessions have a 30-day TTL (`SESSION_TTL_MS`).

Enforcement is instead delegated to individual routes calling `isSuspended(user)`,
which **21 of 31 authenticated routes do not do** (see SEC-010).

**Attack scenario.** A user abusing the platform is suspended by an owner. They
are already signed in. Their session remains valid for up to 30 days, and every
route lacking an explicit `isSuspended` call continues to serve them — including
**all 12 admin routes**, so a suspended ADMIN retains full administrative access.

**Impact.** Suspension is not an effective control. For a suspended
admin/moderator this is a privilege-retention issue, not merely a nuisance.

**Evidence.**
```
$ grep -rn "session.deleteMany" app/api/admin/users/[id]/status/route.ts
(no matches)
```
`validateSession` (lib/server/auth.ts:145) selects `include: { user: true }` and
returns `session.user` with no suspension branch.

**Existing protections.** `createSession` refuses to issue a **new** session to a
suspended account (`SuspendedAccountError`) — so new logins are blocked. Only
pre-existing sessions survive.

**Recommended remediation.** Two changes, ideally both: (1) delete the target's
sessions in the same transaction as the suspension; (2) add a `suspendedAt` check
inside `validateSession` so enforcement is central rather than per-route.

**Fix complexity:** LOW · **Regression risk:** LOW
**Suggested tests:** Suspend a user holding a live session → assert subsequent
`validateSession` returns null and an admin route returns 403.

---

```text
ID:                 SEC-003
Title:              Seed script has no production guard, hardcodes a password, and fabricates engagement metrics
Severity:           HIGH
Confidence:         CONFIRMED
Category:           Production configuration / Product integrity
Affected files:     prisma/seed.ts:37-41 (SEED_DEMO_USER), :84-92 (fabricated counts)
                    package.json ("db:seed": "tsx prisma/seed.ts")
```

**Description.** `prisma/seed.ts` contains no `NODE_ENV` guard. It creates
`demo@seed.crossing.dev` with a **plaintext password committed to the
repository**, and inserts listings with fabricated `votes`, `saves`, and `views`
(e.g. `votes: 91, saves: 58, views: 3600`).

**Attack scenario.** An operator runs `npm run db:seed` with a production
`DATABASE_URL` — plausible during setup, and nothing prevents it. The result is a
production account whose password is public in git history, plus fabricated
social-proof metrics rendered to users as real.

**Impact.** Account compromise (known credentials) and product-integrity
violation (invented engagement presented as genuine).

**Evidence.** `grep -nE "NODE_ENV|production" prisma/seed.ts` returns no guard.
Password confirmed present at line 40 (value withheld from this report).

**Existing protections.** None on the seed path.

**Recommended remediation.** Refuse to run when `NODE_ENV === "production"`
unless an explicit `SEED_ALLOW_PROD=true` override is set. Generate the demo
password randomly and print it once. Consider whether fabricated counts should
exist at all, or be visibly labelled.

**Fix complexity:** LOW · **Regression risk:** NONE
**Suggested tests:** Assert the seed throws under `NODE_ENV=production`.

---

```text
ID:                 SEC-004
Title:              next ≤16.3.0-preview.7 — multiple HIGH advisories including SSRF and cache confusion
Severity:           HIGH
Confidence:         CONFIRMED
Category:           Dependency / Framework
Affected files:     package.json ("next": "^16.0.1")
```

**Description.** Seven advisories, notably: SSRF in rewrites via
attacker-controlled destination hostname (GHSA-p9j2-gv94-2wf4); cache confusion
of response bodies for requests with bodies (GHSA-68g3-v927-f742,
GHSA-4633-3j49-mh5q); middleware/proxy bypass with Turbopack + single locale
(GHSA-6gpp-xcg3-4w24); DoS via Server Actions (GHSA-m99w-x7hq-7vfj).

**Attack scenario.** Cache confusion is the most relevant: several routes are
POST-with-body (`/api/recommend`), and body-keyed cache confusion could serve one
user's response to another. The middleware-bypass advisory would defeat
`proxy.ts`'s protected-path gate.

**Impact.** Potentially cross-user response leakage; auth-gate bypass.
Exploitability in this specific deployment was **not** verified.

**Evidence.** `npm audit --omit=dev` → `next 9.3.4-canary.0 - 16.3.0-preview.7`,
severity high, `direct=true`.

**Existing protections.** No rewrites with dynamic hostnames are configured. No
server actions exist. `/api/recommend` sets `dynamic = "force-dynamic"`.

**Recommended remediation.** Upgrade Next.js to a patched 16.x within the same
major. Re-run the full suite and build.

**Fix complexity:** LOW–MEDIUM · **Regression risk:** MEDIUM (framework)
**Suggested tests:** Full suite + build; manually verify `/control/*` still
redirects unauthenticated.

---

```text
ID:                 SEC-005
Title:              Rate limiting fails open when Upstash is unreachable
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Rate-limit gap / DoS
Affected files:     lib/server/rate-limit.ts:105-116
```

**Description.** `rateLimit()` returns `true` (allow) both when no limiter is
configured and when Redis throws. Every rate limit in the application therefore
disappears during a Redis outage.

**Attack scenario.** An attacker who can induce or wait for Redis unavailability
faces an unthrottled `/api/auth/login` (credential stuffing) and `/api/recommend`
(provider-cost abuse).

**Impact.** Temporary loss of all throttling, including on auth endpoints.

**Evidence.** `lib/server/rate-limit.ts:107` `if (!limiter) return true;` and
`:115` `return true;` inside `catch`.

**Existing protections.** **Meaningful** — `validateEnv()` (invoked from
`instrumentation.ts:8`) makes `UPSTASH_REDIS_REST_URL`/`_TOKEN` **fatal in
production**, so the misconfiguration case cannot ship. Only the transient-outage
case remains.

**Recommended remediation.** Fail *closed* for authentication endpoints
specifically, or add a small in-process fallback counter for when Redis is down.
Full fail-closed is not recommended — it converts a Redis outage into a total
outage.

**Fix complexity:** MEDIUM · **Regression risk:** MEDIUM
**Suggested tests:** Simulate limiter throw → assert login is throttled, search is not.

---

```text
ID:                 SEC-006
Title:              /api/sentry-test guard is inverted — publicly triggerable in production
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Production configuration / DoS
Affected files:     app/api/sentry-test/route.ts:15-22
Affected routes:    GET /api/sentry-test
```

**Description.** The guard reads:

```ts
if (process.env.NODE_ENV === "production" && secret) {
  if (searchParams.get("secret") !== secret) return 403;
}
```

The check only runs **when `SENTRY_TEST_SECRET` is set**. If the variable is
absent — the default, and it is not in the required-env list — the condition is
false, the guard is skipped, and the route throws unconditionally. The safe
default is inverted: absence of configuration disables the protection instead of
enabling it.

**Attack scenario.** `curl https://crossing.dev/api/sentry-test` in a loop:
unauthenticated 500s, Sentry quota exhaustion, and burial of genuine alerts.

**Impact.** Error-budget/quota exhaustion; alert-fatigue masking real incidents.
No data exposure.

**Evidence.** Route source, lines 15–22. `SENTRY_TEST_SECRET` does not appear in
`lib/server/env-validation.ts`.

**Existing protections.** None when the secret is unset.

**Recommended remediation.** Invert to fail-closed: return 404 in production
unless the secret is both configured **and** matched. Better — delete the route;
its own comment says *"Remove this file after you've confirmed events appear."*

**Fix complexity:** TRIVIAL · **Regression risk:** NONE
**Suggested tests:** Assert 404/403 in production with no secret configured.

---

```text
ID:                 SEC-007
Title:              CRON_SECRET accepted via URL query parameter
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Secret exposure
Affected files:     app/api/cron/refresh-evidence/route.ts:15-22
```

**Description.** `authorized()` accepts the secret from the `Authorization`
header **or** from `?secret=`. Query strings are recorded in platform access
logs, CDN logs, proxy logs, browser history, and `Referer` headers on any
outbound navigation.

**Attack scenario.** Anyone with log access — including third-party log
aggregation — recovers `CRON_SECRET` and can trigger ingestion at will, driving
provider cost and crawl volume.

**Impact.** Secret disclosure to log-holders; unauthorized ingestion.

**Evidence.** Line 21: `return url.searchParams.get("secret") === secret;`
The same anti-pattern appears in `app/api/sentry-test/route.ts:19`.

**Existing protections.** Correctly **fails closed** when `CRON_SECRET` is unset
(line 17) — a genuinely good default.

**Recommended remediation.** Accept the header form only. Vercel Cron sends
`Authorization: Bearer $CRON_SECRET`, so the query fallback is unnecessary.

**Fix complexity:** TRIVIAL · **Regression risk:** LOW — confirm Vercel Cron
config uses the header.

---

```text
ID:                 SEC-008
Title:              Content-Security-Policy is report-only unless ENFORCE_CSP is set
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Frontend security / Missing header
Affected files:     next.config.ts:148-156
```

**Description.** The CSP header name is chosen as
`ENFORCE_CSP ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"`,
defaulting to report-only. A report-only CSP blocks nothing.

**Attack scenario.** Any XSS that lands — via a future `dangerouslySetInnerHTML`,
markdown rendering, or a compromised dependency — executes without CSP
interference.

**Impact.** Loss of defense-in-depth. Not directly exploitable today: no XSS sink
was found (see PC-05).

**Evidence.** `next.config.ts:153-155`.

**Existing protections.** Strong companions **are** enforced: `X-Frame-Options:
DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`,
`Strict-Transport-Security`.

**Recommended remediation.** Collect report-only violations from production for a
period, then set `ENFORCE_CSP=true`. Do not flip it blind.

**Fix complexity:** LOW (config) + MEDIUM (violation triage)
**Regression risk:** MEDIUM — a bad CSP breaks the app visibly.

---

```text
ID:                 SEC-009
Title:              /api/recommend is unauthenticated and drives external provider spend
Severity:           MEDIUM
Confidence:         HIGH
Category:           API abuse / Cost
Affected files:     app/api/recommend/route.ts:47-50
                    features/search/providers/registry.ts (SearchBudget)
```

**Description.** `/api/recommend` is public, rate-limited at **20 req/min per
IP**, and each request may issue up to `SEARCH_MAX_QUERIES` (default 6) paid
provider queries. A distributed caller across many IPs can drive real spend.

**Attack scenario.** 100 IPs × 20 req/min × 6 queries × $0.005 = **~$60/minute**
at Bing pricing, before caches warm.

**Impact.** Financial denial-of-wallet. No data exposure.

**Evidence.** `rateLimit(\`recommend:${ip}\`, 20, 60_000)`;
`DEFAULT_BUDGET.maxQueries = 6`.

**Existing protections.** Genuinely layered — a **per-request** budget
(`SearchBudget`: queries/cost/duration), layered discovery that **skips paid
tiers** when the canonical layer suffices, a 6-hour discovery cache with request
coalescing, and no provider configured today (so current spend is zero).

**Recommended remediation.** Add a global daily spend ceiling in addition to the
per-request budget, and lower the per-IP limit before enabling a provider.
Consider requiring auth for uncached queries.

**Fix complexity:** MEDIUM · **Regression risk:** LOW
**Suggested tests:** Assert the global ceiling halts provider calls.

---

```text
ID:                 SEC-010
Title:              Suspension enforcement is per-route and absent from all admin routes
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Broken access control / Systemic
Affected files:     21 of 31 authenticated routes; notably all of app/api/admin/**
```

**Description.** There is no central suspension check (see SEC-002). Each route
opts in by calling `isSuspended(user)`. Measured coverage:

| Group | Routes | Check suspension |
|---|---|---|
| `app/api/admin/**` | 12 | **0** |
| `app/api/sessions*`, `/me/*`, `/security-events` | 7 | **0** |
| `/api/saved/**` | 5 | 5 (via shared guard) |
| Others | 7 | 7 |

**Attack scenario.** A suspended ADMIN retains complete admin API access, since
no admin route checks suspension and their session is not revoked.

**Impact.** Combines with SEC-002 to make suspension ineffective precisely where
it matters most.

**Evidence.** Per-route grep matrix for
`requireAuth|requireAdmin|...` vs `isSuspended` (reproduced in Part 4).

**Existing protections.** `features/saved/guard.ts` demonstrates the correct
pattern — flag → DB → auth → **suspension** → rate limit, in one place.

**Recommended remediation.** Move the check into `validateSession` /
`requireAuth` so it cannot be forgotten, and generalize the `saved` guard pattern.

**Fix complexity:** LOW · **Regression risk:** LOW

---

```text
ID:                 SEC-011
Title:              Upload token issuance lacks magic-byte validation, rate limiting, and quota
Severity:           MEDIUM
Confidence:         HIGH
Category:           Unsafe file handling / Cost
Affected files:     app/api/upload/route.ts:93-120
                    lib/server/storage.ts:100-130 (validateProfileAsset)
```

**Description.** Three gaps. (1) Content type is validated from the
**client-declared** MIME only — `allowedContentTypes` constrains the header the
client sets, and there is no magic-byte check. (2) No rate limit on token
issuance (`rl=0` in the route matrix). (3) No per-user storage quota.
A code comment concedes *"fine-grained MIME-level size enforcement happens
client-side"* — which is not enforcement.

**Attack scenario.** An authenticated user requests unlimited blob tokens
(storage-cost abuse), and uploads content whose declared type does not match its
bytes.

**Impact.** Storage cost abuse; content-type confusion. **Stored-XSS risk is
low** because SVG and HTML are absent from every allowlist
(`lib/server/storage.ts:69-88`) — a genuinely good decision.

**Evidence.** Route matrix shows upload `rl=0`. `ASSET_CONSTRAINTS` mimes are
JPEG/PNG/WebP/GIF/MP4/WebM only.

**Existing protections.** No SVG/HTML. Server-issued scoped tokens. Path is
`profiles/{userId}/...` with `randomUUID()`, and the extension is sanitized to
`[a-z0-9]` — **path traversal is not possible**. Size caps enforced by the token.

**Recommended remediation.** Add rate limiting and a per-user quota. Validate
magic bytes post-upload. Stop returning `detail: message` on error (SEC-013).

**Fix complexity:** MEDIUM · **Regression risk:** LOW

---

```text
ID:                 SEC-012
Title:              All cross-user isolation tests are skipped in CI
Severity:           MEDIUM
Confidence:         CONFIRMED
Category:           Test coverage gap
Affected files:     features/saves/data.test.ts, features/votes/data.test.ts,
                    features/submissions/data.test.ts, features/listings/*.test.ts
```

**Description.** 30 tests skip without a database. They include **every**
tenant-isolation assertion the repository has:
*"listSavedListings — only returns the given user's saves, not another user's"*,
*"listUserSubmissions — only returns the calling user's own submissions"*,
*"listVotedListings — only returns the given user's votes"*.

**Attack scenario.** A future refactor drops a `where: { userId }` clause and no
test fails. The regression ships silently.

**Impact.** The repository's most security-relevant guarantees are unverified in
CI. This is a **meta-finding**: it does not prove a vulnerability, it proves the
absence of a safety net.

**Evidence.** `npm test` → `skipped 30`; all skips enumerated are DB-dependent.

**Existing protections.** The code paths were read manually during this audit and
scope correctly by `userId`. That is not a substitute for execution.

**Recommended remediation.** Provision a disposable Postgres in CI (Docker
service or Neon branch) and run the integration suite there.

**Fix complexity:** MEDIUM (CI work) · **Regression risk:** NONE

---

```text
ID:                 SEC-013
Title:              Internal error detail returned to clients from the upload route
Severity:           LOW
Confidence:         CONFIRMED
Category:           Data exposure
Affected files:     app/api/upload/route.ts:117
```

**Description.** `return NextResponse.json({ error: "token_generation_failed",
detail: message }, { status: 500 })` returns the raw exception message.

**Impact.** Possible disclosure of internal configuration or dependency detail.
Low — the surrounding code does not embed secrets in exceptions.

**Existing protections.** Most other routes return generic errors;
`lib/server/api-result.ts`'s `fromThrown()` maps Prisma errors to safe client
codes without leaking driver detail.

**Recommended remediation.** Log `message` server-side; return only the code.

**Fix complexity:** TRIVIAL · **Regression risk:** NONE

---

```text
ID:                 SEC-014
Title:              Non-constant-time secret comparison in cron authorization
Severity:           LOW
Confidence:         CONFIRMED
Category:           Cryptographic hygiene
Affected files:     app/api/cron/refresh-evidence/route.ts:19,21
```

**Description.** Both comparisons use `===`, which short-circuits on first
mismatch. Remote timing attacks over HTTP against a 32-byte secret are not
practically exploitable given network jitter, but `timingSafeEqual` is already
imported elsewhere in the codebase (`lib/server/auth.ts`).

**Recommended remediation.** Use `crypto.timingSafeEqual` on equal-length buffers.

**Fix complexity:** TRIVIAL · **Regression risk:** NONE

---

```text
ID:                 SEC-015
Title:              Cron endpoint has no concurrency or idempotency lock
Severity:           LOW
Confidence:         HIGH
Category:           Race condition / Cost
Affected files:     app/api/cron/refresh-evidence/route.ts:35-80
```

**Description.** Concurrent authorized invocations run overlapping ingestion; no
advisory lock or run marker exists.

**Impact.** Duplicate crawls and duplicate provider cost. Requires the secret, so
the practical actor is a misconfigured scheduler rather than an attacker.

**Existing protections.** Good: skip-fresh via `freshWithinMs`, failed-entity
backoff (`retryFailed`), a `maxDurationMs` time budget, deterministic
cursor pagination, and per-entity fault isolation.

**Recommended remediation.** Take a Postgres advisory lock, or record an
in-progress run row and no-op if one is active.

**Fix complexity:** LOW · **Regression risk:** LOW

---

```text
ID:                 SEC-016
Title:              Client IP falls back to spoofable x-forwarded-for
Severity:           LOW
Confidence:         HIGH
Category:           Rate-limit bypass
Affected files:     lib/server/rate-limit.ts:136-150
```

**Description.** `clientIpFromHeaders` prefers `x-vercel-forwarded-for` (not
spoofable on Vercel), then `x-real-ip`, then `x-forwarded-for`. On any
non-Vercel deployment without a header-sanitizing proxy, a client can set
`x-forwarded-for` freely and rotate its rate-limit key per request.

**Impact.** Complete per-IP rate-limit evasion **off Vercel**. On Vercel the
first branch wins and the issue does not arise.

**Existing protections.** Correct priority ordering; the Vercel header is
documented as unspoofable and checked first.

**Recommended remediation.** Only honor forwarded headers when a
`TRUST_PROXY`-style variable is set; otherwise use the socket address.

**Fix complexity:** LOW · **Regression risk:** MEDIUM (could mis-key limits)

---

```text
ID:                 SEC-017
Title:              Transitive dependency advisories (sharp, postcss, uuid, brace-expansion, fast-uri)
Severity:           LOW
Confidence:         CONFIRMED
Category:           Supply chain
Affected files:     package-lock.json
```

| Package | Range | Severity | Reachability |
|---|---|---|---|
| `sharp` | <0.35.0 | HIGH | Build/image-opt only; not on a user-input path |
| `postcss` | ≤8.5.17 | HIGH | Build-time via `next`; not runtime |
| `uuid` | <11.1.1 | MODERATE | Via next-auth; `buf` arg not used by app code |
| `brace-expansion` | ≤5.0.7 | HIGH | Tooling/glob only |
| `fast-uri` | 3.0.0–3.1.3 | HIGH | Transitive; not directly invoked |

**Description.** All five are transitive and none sits on an obvious
attacker-reachable runtime path. `sharp`'s libvips CVEs would matter if
user-supplied images were processed server-side — uploads currently go directly
to Vercel Blob without server-side transformation, which limits exposure.

**Recommended remediation.** `npm audit fix` (non-major) and re-run the suite.
Do not force major upgrades in this pass.

**Fix complexity:** LOW · **Regression risk:** LOW

---

```text
ID:                 SEC-018
Title:              Middleware performs no role check; admin authorization is page/route-local
Severity:           LOW
Confidence:         CONFIRMED
Category:           Defense in depth
Affected files:     proxy.ts:12-24
```

**Description.** `proxy.ts` checks only for the **presence** of a session cookie
on `/control/:path*`. Any authenticated user passes the middleware; role
enforcement happens later in the page (`isAdmin(user)` → `notFound()`) and in
each admin API route.

**Impact.** No bypass found — every admin page and route checked does enforce
its own role. This is a single-layer-of-defense observation, and it is why the
Next.js middleware-bypass advisory in SEC-004 matters more than it otherwise
would.

**Existing protections.** `app/(dashboard)/control/admin/evidence/page.tsx:53`
performs `if (!user || !isAdmin(user)) notFound()` — using `notFound()` rather
than a 403, which correctly avoids confirming the route exists.

**Recommended remediation.** Keep page-level checks as the source of truth; treat
this as accepted risk or add a role check in middleware once SEC-004 is patched.

**Fix complexity:** MEDIUM · **Regression risk:** MEDIUM

---

```text
ID:                 SEC-019
Title:              Legal and journal content is unreviewed draft material served publicly
Severity:           LOW
Confidence:         CONFIRMED
Category:           Product integrity / Compliance
Affected files:     app/(root)/terms, /privacy, /cookies, /policies, /dmca
```

**Description.** Legal pages carry a visible "Draft — not legally reviewed"
banner (asserted by an existing test) but are publicly routable and linked from
the footer.

**Impact.** Not a security vulnerability. Flagged because a public site with
placeholder legal text creates compliance exposure that only the owner can
resolve.

**Existing protections.** The draft banner is present and test-enforced — an
honest disclosure, correctly implemented.

**Recommended remediation.** Owner action: obtain reviewed legal copy before
public launch.

**Fix complexity:** N/A (owner) · **Regression risk:** NONE

---

```text
ID:                 SEC-020
Title:              Review-provider terms are developer-summarized and require owner legal review
Severity:           INFORMATIONAL
Confidence:         CONFIRMED
Category:           Data licensing
Affected files:     features/search/reviews/providers.ts
```

**Description.** `PROVIDER_TERMS` documents authentication, caching windows,
attribution, and retention for nine providers. These are **developer summaries of
published documentation, not legal advice** — the file says so explicitly.

**Impact.** Enabling a provider on the strength of these summaries alone risks a
terms breach (e.g. Yelp's 24-hour caching limit vs. this app's caching layer).

**Existing protections.** Strong and deliberate: no unimplemented provider has a
stub adapter; `mayStoreReviewText: false` for Trustpilot with
`fetchReviewEvidence` intentionally unimplemented; every provider carries a
`requiredAction`.

**Recommended remediation.** Owner/counsel review before enabling any provider.
Specifically reconcile Yelp/Google Places caching limits against
`features/search/cache.ts` TTLs **before** those adapters are built.

**Fix complexity:** N/A (owner) · **Regression risk:** NONE

---

```text
ID:                 SEC-021
Title:              Search queries are logged in full in development
Severity:           INFORMATIONAL
Confidence:         CONFIRMED
Category:           Privacy
Affected files:     features/search/diagnostics.ts:toLogLine
```

**Description.** `toLogLine(d, includeQuery)` is called with `includeQuery =
!isProd`. Production logs record `queryLength` only.

**Impact.** None in production — this is the **correct** design and is noted as a
positive. Recorded so the boundary is documented: if a future admin diagnostics
surface passes `includeQuery: true` in production, queries become durable log
data subject to the privacy policy.

**Recommended remediation.** None. Preserve the invariant.

---

```text
ID:                 SEC-022
Title:              No global request-size limit on JSON bodies
Severity:           INFORMATIONAL
Confidence:         MODERATE
Category:           DoS
Affected files:     All routes calling request.json()
```

**Description.** Individual fields are bounded by Zod (`MAX_QUERY_LENGTH = 300`,
cursor ≤512), but no route caps the raw body before parsing. Next.js/Vercel
imposes a platform limit (~4.5 MB for serverless functions), so the practical
exposure is bounded by the platform rather than by the application.

**Recommended remediation.** Optional: check `Content-Length` before parsing on
public routes. Low value given platform limits.

---

```text
ID:                 SEC-023
Title:              Legacy fixture corpus remains importable from application code
Severity:           INFORMATIONAL
Confidence:         CONFIRMED
Category:           Dead code / Product integrity
Affected files:     features/recommendation/fixtures.ts
                    features/search/live-default.ts:87
```

**Description.** `buildFixtures()` (17 fictional products with invented ratings
and review counts) is still importable and is referenced in `live-default.ts`
behind the demo-mode branch.

**Impact.** No production exposure — `isDemoMode()` returns false whenever
`NODE_ENV === "production"`, and this is test-enforced. Flagged because the
fictional corpus remaining reachable at all is a standing footgun.

**Existing protections.** Strong: `isDemoMode` production guard, `requireCanonical`
defaulting true, and a test asserting no fixture name appears in an unavailable
response.

**Recommended remediation.** Once the legacy `/api/recommend` projection is
retired, move fixtures under a test-only path.

---

# Part 21 — Prioritized remediation plan

## P0 — fix immediately (blocks production)

| ID | Title | Effort |
|---|---|---|
| SEC-003 | Seed production guard + remove hardcoded password | TRIVIAL |
| SEC-006 | Invert `/api/sentry-test` guard, or delete the route | TRIVIAL |
| SEC-002 | Revoke sessions on suspension | LOW |

## P1 — fix before public beta

| ID | Title | Effort |
|---|---|---|
| SEC-001 | Upgrade next-auth (patch within 4.x) | LOW |
| SEC-004 | Upgrade Next.js (patch within 16.x) | LOW–MED |
| SEC-010 | Centralize suspension in `validateSession` | LOW |
| SEC-007 | Drop query-param cron secret | TRIVIAL |
| SEC-009 | Global provider spend ceiling (**before** enabling a provider) | MEDIUM |
| SEC-011 | Upload rate limit + quota | MEDIUM |

## P2 — fix before scale

SEC-005 (fail-closed auth limits) · SEC-008 (enforce CSP after triage) ·
SEC-012 (CI database) · SEC-015 (cron lock) · SEC-016 (trust-proxy) ·
SEC-017 (`npm audit fix`)

## P3 — cleanup

SEC-013 · SEC-014 · SEC-018 · SEC-023

## Quick wins

Five findings are trivial-effort and high-value: **SEC-006**, **SEC-007**,
**SEC-003**, **SEC-013**, **SEC-014**. All five are single-file, low-regression
changes that could land in one short session.

## Systemic risks

1. **Opt-in security checks.** SEC-002, SEC-010, and the SEC-011 rate-limit gap
   all trace to the same root: enforcement is per-route rather than centralized.
   `features/saved/guard.ts` already demonstrates the fix; generalizing it would
   close three findings at once and prevent the next one.
2. **Fail-open / inverted defaults.** SEC-005, SEC-006, and SEC-008 each default
   to the permissive state when configuration is absent. The convention should be
   inverted: absent configuration means the protection is **on**, not off.
3. **Secrets in URLs.** SEC-007 and SEC-006 share the query-string-secret
   pattern.
4. **Untested guarantees.** SEC-012 means the isolation properties this audit
   verified by reading are not defended by CI.

## Positive controls

Each verified in code during this audit.

| ID | Control | Evidence |
|---|---|---|
| PC-01 | **SSRF defense** — DNS-resolution-based, per-hop redirect revalidation, IPv4/IPv6 private + link-local + metadata + IPv4-mapped-IPv6 blocking, size cap, timeout, content-type allowlist | `features/ingestion/ssrf.ts`, `fetcher.ts` |
| PC-02 | **Password reset** — SHA-256-hashed token, 1-hour TTL, single-use, prior tokens purged, sessions invalidated on confirm | `app/api/auth/password-reset/**` |
| PC-03 | **Boot-time env validation** — fatal in production, invoked from `instrumentation.ts` | `lib/server/env-validation.ts:59`, `instrumentation.ts:8` |
| PC-04 | **DB-backed sessions** — role read fresh per request, so no stale-JWT privilege class exists | `lib/server/auth.ts:145` |
| PC-05 | **No injection sinks** — zero `dangerouslySetInnerHTML`, `eval`, `new Function`, `child_process`, or raw SQL in app code | repo-wide grep |
| PC-06 | **Centralized saved-items guard** — flag → DB → auth → suspension → rate limit | `features/saved/guard.ts` |
| PC-07 | **Category gating** — unsupported queries never reach retrieval; no software fallback | `features/recommendation/categories/resolve.ts` |
| PC-08 | **Bounded agent** — iteration/query/URL/time/cost limits enforced by the loop, not by prompt text; a planner returning 50 queries is clamped | `features/search/discovery/agentic.ts` |
| PC-09 | **Evidence independence** — four independent layers prevent vendor ratings becoming reputation; `assertIndependentProvider` throws at registration | `features/search/reviews/types.ts`, `evidence/classes.ts`, `sources/types.ts` |
| PC-10 | **Deterministic ranking** — no model input to ordering; stable comparators | `features/search/ranking/profiles.ts` |
| PC-11 | **Safe redirects** — `safeInternalPath` rejects absolute, protocol-relative, `javascript:`, `data:`, and control characters, with tests | `lib/auth-redirect.ts` |
| PC-12 | **Non-destructive migrations** — no DROP/TRUNCATE/DELETE; `vercel-build` uses `prisma migrate deploy`, never `db push` | `prisma/migrations/`, `package.json` |
| PC-13 | **No server actions** — entire mutation surface is explicit API routes | repo-wide grep |
| PC-14 | **Upload path safety** — `profiles/{userId}/{type}/{uuid}.{sanitized-ext}`; no SVG or HTML in any allowlist | `app/api/upload/route.ts:93-95` |
| PC-15 | **Production diagnostics suppression** — traces, scores, and query text omitted in production, test-enforced | `features/search/diagnostics.ts` |
| PC-16 | **Security headers** — HSTS, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy all enforced | `next.config.ts:195-220` |
| PC-17 | **Admin enumeration resistance** — admin pages return `notFound()` rather than 403 | `control/admin/evidence/page.tsx:53` |
| PC-18 | **Privilege-escalation guard** — `canModifyUser` requires the actor to strictly outrank the target; ADMIN cannot modify peer ADMINs | `lib/server/auth.ts:66` |

---

## Validation performed

| Command | Result |
|---|---|
| `npx prisma validate` | ✅ schema valid |
| `npx tsc --noEmit` | ✅ clean |
| `npx eslint .` | ✅ clean |
| `npm test` | ✅ 523 tests · 493 pass · 0 fail · **30 skipped** |
| `npx next build` | ✅ compiled |
| `npm audit --omit=dev` | ⚠️ 7 advisories (1 critical, 5 high, 1 moderate) |
| Repo-wide dangerous-pattern grep | ✅ no sinks found |
| Secret scan over tracked files | ⚠️ 1 hit → SEC-003 |

## Not verified

- Runtime cookie flags (`Secure`/`HttpOnly`/`SameSite`) — read from config only.
- CSP behavior against a real browser.
- Live provider paths (no credentials); exercised against stubs only.
- Cross-user isolation at runtime (SEC-012).
- Concurrency/race behavior under real load.
- Exploitability of the Next.js advisories in this deployment.
