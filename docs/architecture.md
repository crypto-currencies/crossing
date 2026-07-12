# Architecture

This describes the foundation as it exists today — infrastructure only, no
discovery-product code yet. See `product-scope.md` for what's being built on
top of it.

## App structure

Next.js App Router with three route groups plus API routes:

| Group | Layout | Contains |
|---|---|---|
| `(root)` | Nav only | Public marketing/legal pages (`/`, `/terms`, `/privacy`, `/policies`, `/dmca`, `/suspended`) |
| `(auth)` | Centered auth panel | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/oauth-callback` |
| `(dashboard)` | Nav + sidebar | Authenticated app: `/dashboard`, `/settings`, `/notifications`, `/support`, `/control/admin` |

`app/api/*` holds all backend routes (auth, account, admin, notifications,
upload, health, sentry-test). There are no server actions yet — every
mutation goes through a `route.ts` handler.

### Where future product domains belong

This app does **not** yet have `features/` domain folders — there's no
discovery-product code to organize. When listings/search/categories/
submissions/moderation/saves/votes are built, give each its own top-level
folder:

```
features/
  listings/       # listing CRUD, listing page, listing card
  search/         # search UI + query logic
  categories/     # category pages, category nav
  collections/    # curated collections
  submissions/    # the "submit a listing" flow
  moderation/     # approve/reject queue (distinct from admin/ user moderation)
  saves/          # bookmarking
  votes/          # voting/ranking signal
```

Each `features/<domain>/` folder should own its components, its
`route.ts` handlers (colocate under `app/api/<domain>/` and keep business
logic in `features/<domain>/`), its Prisma model(s), and its types. Platform
infrastructure (auth, admin, settings, email, rate limiting, UI kit) stays
where it is now — `app/`, `components/`, `lib/`, `store/` — because it isn't
owned by any single product domain.

## Authentication flow

NextAuth v4 (`app/api/auth/[...nextauth]/route.ts`) handles Google OAuth
sign-in only. Email/password is a **separate, custom** system:

1. **Email/password**: `POST /api/auth/login` verifies the password (scrypt,
   `lib/server/auth.ts`), creates a `Session` row, and returns a Bearer token
   + sets an httpOnly `session_token` cookie.
2. **Google OAuth**: NextAuth issues its own JWT cookie, then the client hits
   `/oauth-callback`, which calls `GET /api/auth/google-token` to exchange the
   NextAuth JWT for the same custom `Session` row / Bearer token used by
   email/password. This keeps exactly one session mechanism for the rest of
   the app to check, regardless of how the user signed in.
3. Every subsequent request authenticates via `requireAuth()` (Bearer header
   or `session_token` cookie), never by reading the NextAuth JWT directly
   (except inside the bridge route itself).

Client state: `store/auth.ts` (Zustand, persisted) holds `{ session, user }`.
`components/providers/providers.tsx` rehydrates it on mount and revalidates
the token against the server.

## Database access conventions

- `lib/db.ts` exports a lazy `db` proxy (Prisma Client over `@prisma/adapter-pg`).
  Importing it is always safe, even without `DATABASE_URL` set (e.g. at build
  time) — the real client is only instantiated on first property access.
- `DB_AVAILABLE` (also from `lib/db.ts`) is `true` iff `DATABASE_URL` is set.
  Every route that touches the database checks it first and returns `503`
  if it's `false`, so the app never 500s just because a database isn't
  configured yet (useful for previewing the UI without a DB).
- Prisma is called directly from route handlers — there is no repository or
  service layer. Keep it that way until a domain genuinely needs shared query
  logic across multiple routes; then put that logic in
  `features/<domain>/` (see above), not in a new generic `lib/services/` mega-layer.

## Server vs. client components

- Route `page.tsx`/`layout.tsx` files are Server Components by default and do
  data fetching directly (see `app/(dashboard)/control/admin/page.tsx` for the
  pattern: fetch in the page, pass plain serializable props to a `"use
  client"` child).
- Anything interactive (forms, modals, tabs, anything using Zustand or
  `useState`/`useEffect`) is a separate `*-client.tsx` component marked
  `"use client"`.  Don't add `"use client"` to a page file — extract a client
  child instead, so the page itself can still do server-side data fetching
  and auth checks.

## API route conventions

Every `route.ts` handler follows the same shape:

```ts
export async function POST(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request); // or requireAdminApi / requireOwnerApi
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); // 403 for admin routes

  // rate limit check, then parse + validate body, then do the work, then respond
}
```

- Responses are always `NextResponse.json({ ...) }, { status })`. Errors are
  `{ error: "snake_case_code" }`, optionally with a human-readable `message`.
  Never leak stack traces or raw Prisma errors to the client.
- Admin routes return `403` (not `401`) on auth failure so an unauthenticated
  caller can't distinguish "route exists but you're not admin" from "route
  doesn't exist."

## Validation conventions

There is no schema-validation library (no Zod, no Yup) in this codebase —
routes hand-check `typeof body.field === "string"` etc. and return
`invalid_body` / `missing_fields` on failure. Keep doing this for simple
shapes. If a domain's input shapes get complex enough that this becomes
unwieldy (e.g. listing submission with many optional fields), that's a
reasonable point to introduce a validation library — scope it to that
domain, don't retrofit it everywhere at once.

## Authorization conventions

Three helpers in `lib/server/admin.ts` and `lib/server/auth.ts` cover
everything:

- `requireAuth(request)` — any signed-in, non-suspended user.
- `requireAdminApi(request)` — role is `ADMIN` or `OWNER`.
- `requireOwnerApi(request)` — role is `OWNER`.

All three re-read the user from the database on every call (never trust a
cached role from a token), and `requireAdminApi`/`requireOwnerApi`
auto-bootstrap the `OWNER` role for whichever account's email matches
`OWNER_EMAIL` the first time it's seen. There is no per-action step-up
re-verification layer — role checks alone gate admin actions. Every
destructive admin action should call `writeAuditLog()` (`lib/server/admin.ts`)
regardless.

## Error handling conventions

- API routes: catch at the route level, return a JSON error shape (see
  above). Routes that call third-party services (Resend, Blob, Upstash)
  degrade gracefully where possible (e.g. rate limiting silently disables
  itself if Upstash isn't configured, logging a warning) rather than failing
  the whole request.
- Client: `useToastStore` (`store/toast.ts`) surfaces user-facing errors.
  `app/error.tsx` / `app/global-error.tsx` catch render-time exceptions;
  Sentry (`instrumentation.ts`, `sentry.*.config.ts`) captures both.
- `lib/server/env-validation.ts` throws at boot in production if a required
  env var is missing, and only warns in development — fail fast in prod,
  stay usable locally.

## Caching conventions

None yet, beyond Next.js's defaults (route handlers are dynamic by default
since they read cookies/headers for auth). When listings/search are built
and read traffic dominates, that's the point to introduce explicit caching
(`revalidate`, `unstable_cache`, or a CDN-level strategy) — don't add it
speculatively now.
