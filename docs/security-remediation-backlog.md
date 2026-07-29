# Security remediation backlog

Companion to [security-audit.md](./security-audit.md). Ordered by recommended
execution sequence. **Status is `Open` for every item — no remediation has been
performed.**

Suggested-agent key: **Claude** = backend/security · **ChatGPT** =
frontend/privacy presentation · **Owner** = credentials/legal/provider approval ·
**External** = legal or security specialist.

---

## P0 — before any production deployment

| # | ID | Sev | Summary | Owner area | Depends on | Complexity | Migration | Env change | Manual owner action | Agent | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SEC-006 | MEDIUM | Invert `/api/sentry-test` guard to fail-closed, or delete the route | API / config | — | Trivial | No | No | Decide: keep behind a secret, or delete | Claude | Open |
| 2 | SEC-003 | HIGH | Add production guard to `prisma/seed.ts`; randomize demo password; review fabricated vote/save/view counts | DB / integrity | — | Trivial | No | Optional `SEED_ALLOW_PROD` | Confirm seed never ran against prod | Claude | Open |
| 3 | SEC-007 | MEDIUM | Remove query-param `CRON_SECRET` fallback | Cron | — | Trivial | No | No | Confirm Vercel Cron sends the header | Claude | Open |
| 4 | SEC-002 | HIGH | Revoke sessions on suspension (delete in same transaction) | Auth | — | Low | No | No | — | Claude | Open |

---

## P1 — before public beta

| # | ID | Sev | Summary | Owner area | Depends on | Complexity | Migration | Env change | Manual owner action | Agent | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | SEC-010 | MEDIUM | Centralize suspension check in `validateSession`/`requireAuth` | Auth | SEC-002 | Low | No | No | — | Claude | Open |
| 6 | SEC-001 | HIGH | Upgrade `next-auth` to patched 4.x | Deps / auth | — | Low | No | No | Re-test Google sign-in after upgrade | Claude | Open |
| 7 | SEC-004 | HIGH | Upgrade `next` to patched 16.x | Deps / framework | — | Low–Med | No | No | Smoke-test deployed build | Claude | Open |
| 8 | SEC-013 | LOW | Stop returning raw `detail` from upload errors | API | — | Trivial | No | No | — | Claude | Open |
| 9 | SEC-011 | MEDIUM | Upload rate limit + per-user quota + magic-byte validation | Uploads | — | Medium | Maybe (quota table) | No | Decide quota size | Claude | Open |
| 10 | SEC-009 | MEDIUM | Global daily provider-spend ceiling | Search / cost | — | Medium | Maybe (counter store) | Optional caps | **Set spend ceiling before enabling a provider** | Claude + Owner | Open |

---

## P2 — before scale

| # | ID | Sev | Summary | Owner area | Depends on | Complexity | Migration | Env change | Manual owner action | Agent | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | SEC-017 | LOW | `npm audit fix` for transitive advisories (no majors) | Deps | 6, 7 | Low | No | No | — | Claude | Open |
| 12 | SEC-012 | MEDIUM | Provision CI Postgres so the 30 skipped isolation tests run | CI / testing | — | Medium | No | CI `DATABASE_URL` | Approve CI DB (Neon branch or Docker) | Claude + Owner | Open |
| 13 | SEC-015 | LOW | Advisory lock / run marker for cron ingestion | Cron | — | Low | Maybe (run table) | No | — | Claude | Open |
| 14 | SEC-005 | MEDIUM | Fail-closed rate limiting on auth endpoints only | Rate limiting | — | Medium | No | No | Accept: Redis outage blocks logins | Claude + Owner | Open |
| 15 | SEC-016 | LOW | Gate forwarded-header trust behind `TRUST_PROXY` | Rate limiting | — | Low | No | `TRUST_PROXY` | Confirm deployment topology | Claude | Open |
| 16 | SEC-008 | MEDIUM | Triage CSP report-only violations, then set `ENFORCE_CSP=true` | Frontend / headers | — | Low + triage | No | `ENFORCE_CSP` | Review violation reports from prod | ChatGPT + Owner | Open |

---

## P3 — cleanup

| # | ID | Sev | Summary | Owner area | Depends on | Complexity | Migration | Env change | Manual owner action | Agent | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 17 | SEC-014 | LOW | `timingSafeEqual` for cron secret comparison | Cron | 3 | Trivial | No | No | — | Claude | Open |
| 18 | SEC-018 | LOW | Consider a role check in middleware (defense in depth) | Middleware | 7 | Medium | No | No | Accept risk, or approve the change | Claude + Owner | Open |
| 19 | SEC-023 | INFO | Move fixture corpus to a test-only path once the legacy projection retires | Search | Legacy contract retirement | Low | No | No | — | Claude | Open |
| 20 | SEC-022 | INFO | Optional `Content-Length` pre-parse cap on public routes | API | — | Low | No | No | — | Claude | Open |
| 21 | SEC-021 | INFO | Preserve the "no query text in prod logs" invariant | Privacy | — | None | No | No | — | Claude | Open |

---

## Owner / external — cannot be delegated to an agent

| # | ID | Sev | Summary | Why it needs the owner | Agent | Status |
|---|---|---|---|---|---|---|
| 22 | SEC-019 | LOW | Legal pages are unreviewed drafts served publicly | Requires reviewed legal copy | External (legal) | Open |
| 23 | SEC-020 | INFO | Review-provider terms are developer summaries, not legal advice | **Reconcile Yelp/Google Places caching limits against `features/search/cache.ts` TTLs before building those adapters** | External (legal) + Owner | Open |
| — | — | — | Obtain `TRUSTPILOT_API_KEY` to enable reputation evidence | Commercial registration | Owner | Open |
| — | — | — | Choose and fund a search provider (Brave/Bing/Serper/Google PSE) | Commercial + cost decision | Owner | Open |

---

## Recommended first batch

Items **1–4** (all P0). Together they are four files, roughly one focused
session, and no migration or environment change beyond an optional seed
override. They close both HIGH findings that are fully within our control
(SEC-002, SEC-003) plus the two trivial secret-handling issues.

Sequencing note: do **not** start item 10 (spend ceiling) as remediation work —
it is only load-bearing once a search provider is actually enabled, and no
provider is configured today.
