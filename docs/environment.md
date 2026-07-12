# Environment variables

Every variable read anywhere in the codebase, classified by where it's
actually required. "Preview" means a Vercel preview deployment (shares
production-like `NODE_ENV=production` behavior but typically points at a
throwaway/dev database).

Source of truth for the hard-required set is `lib/server/env-validation.ts`,
enforced at boot via `instrumentation.ts` (throws in production, warns in
development). Everything below matches what that file actually checks, plus
variables it doesn't check but the code still reads.

## Required locally (to run `npm run dev` meaningfully)

| Variable | Why |
|---|---|
| `DATABASE_URL` | Without it, `DB_AVAILABLE` is `false` and every DB-backed route returns 503. The app boots and renders static pages fine without it, but nothing that touches accounts works. |
| `NEXTAUTH_SECRET` | NextAuth throws internally without a secret. Any random 32+ char string works locally. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Only needed if you want to test Google sign-in locally. Email/password auth works without them. |

Everything else is optional locally — features that depend on an unset var
degrade gracefully (see "Optional" below) rather than crashing the dev server.

## Required in preview

Same hard-required set as production (`env-validation.ts` enforces this
identically whenever `NODE_ENV === "production"`, which Vercel preview builds
use):

| Variable | Reason |
|---|---|
| `DATABASE_URL` | Postgres connection — nothing works without it |
| `NEXTAUTH_SECRET` (or `AUTH_SECRET`) | JWT encryption, session signing, OAuth state signing |
| `NEXTAUTH_URL` (or `NEXT_PUBLIC_APP_URL`) | Base URL for OAuth callbacks and email links |
| `OWNER_EMAIL` | Owner bootstrap — platform has no OWNER without it |
| `BLOB_READ_WRITE_TOKEN` | File uploads return 503 without it |
| `RESEND_API_KEY` / `EMAIL_FROM` | Password reset and verification emails |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting is silently disabled without these — every endpoint becomes unthrottled |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Not enforced by `env-validation.ts`, but Google sign-in silently fails without them — treat as required for a usable preview |

Use a separate preview database/Blob store/Resend sender from production so a
broken preview build can't touch real user data.

## Required in production

Identical list to "required in preview" above — `env-validation.ts` makes no
distinction between preview and production (both are `NODE_ENV=production`).
The only difference is which actual values you put in each (never share the
production `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, etc. with preview).

Additionally in production only:

| Variable | Why |
|---|---|
| `ENFORCE_CSP` | Set to `true` once you've watched DevTools for CSP violations for a few days on report-only. Until then, leave unset — CSP is report-only and logs but doesn't block. |

## Optional

| Variable | Effect if unset |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry doesn't initialize; errors aren't captured. No crash. |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Source map upload is skipped at build time; stack traces in Sentry are minified. |
| `SENTRY_TEST_SECRET` | `/api/sentry-test` is open in non-production; in production it 404s without a matching `?secret=`. |
| `INTERNAL_NOTIFICATIONS_SECRET` | `POST /api/notifications` (server-to-server system notification creation) rejects all callers. Not exercised by any current caller — reserved for a future feature (e.g. "submission approved" notification) that needs to call it. |
| `APP_URL` / `AUTH_URL` / `SITE_URL` | Fallback base-URL sources read by `getBaseUrl()` (`lib/server/url.ts`) after `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`. Only needed if neither of those is set. |
| `AUTH_SECRET` | Alternate name for `NEXTAUTH_SECRET` (Auth.js v5 convention). Either satisfies the requirement; this codebase uses NextAuth v4, so set `NEXTAUTH_SECRET`. |
| `CI` | Only silences Sentry's build-time upload logging; has no effect outside CI. |

## Currently unused (do not set)

None — every variable in `.env.example` is read somewhere in the code as of
this pass. (`NEXT_PUBLIC_ANALYTICS_ENABLED`, a dead flag from the old
profile-analytics feature with zero references, was removed from
`.env.example` during this cleanup rather than left as a documented-but-dead
entry.)

## Fixed during this pass

`next.config.ts`'s CSP enforcement switch checked `process.env.CSP_REPORT_ONLY`
(undocumented, inverted polarity) while its own comments and `.env.example`
both described `ENFORCE_CSP` as the toggle — meaning setting `ENFORCE_CSP=true`
in production silently did nothing. Fixed so the code now checks
`ENFORCE_CSP`, matching the documentation.
