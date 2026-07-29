# Product surface audit

Every user-reachable route, its real status, and what it needs before launch.
Written during the stabilization sprint; update it whenever a route changes state.

**Status legend:** Functional · Partially functional · Placeholder (intentional
empty state) · Empty (blank — must never persist) · Broken · Redirect · Remove
from nav.

**Launch requirement:** Blocker = cannot launch without it. Beta = needed for a
public beta. Later = post-launch.

## Consumer core

| Route | Purpose | Status | Missing | Action taken / recommended | Launch req. | Priority |
|---|---|---|---|---|---|---|
| `/` | Homepage + primary search | Functional | Demo uses illustrative Places/Services data | Fixed: suggestions now only supported categories; dropdown clipping fixed; fake Save removed; coverage note added | Blocker | P0 |
| `/search?q=` | Real recommendation results | Functional | Visual polish (see Phase 9 note below) | Kept as canonical results route | Blocker | P0 |
| `/search` (no query) | — | Redirect | — | Redirects to `/#search` (bare page duplicated the hero) | Blocker | P0 |
| `/login`, `/register` | Auth | Functional | Visual identity is minimal | Google sign-in wired, loading/error states, safe redirect | Blocker | P0 |
| `/oauth-callback` | OAuth → DB session bridge | Functional | — | Implemented (was a spinner-only stub) | Blocker | P0 |
| `/about` | What Crossing is | Functional | — | Written truthfully, incl. current limits | Beta | P1 |
| `/contribute` | How contributing works | Partially functional | No submission action | Added explicit "not open yet" state + real links | Beta | P1 |
| `/discover` | Curated discovery | Placeholder | Everything | Intentional empty state → search | Later | P2 |
| `/browse`, `/browse/[category]` | Category directory | Placeholder / Redirect | Category data + UI | `/browse` = empty state; `[category]` redirects to `/browse` | Later | P2 |
| `/category/[slug]`, `/listing/[slug]` | Entity detail | Redirect | Entity pages | Redirect to `/browse` | Later | P2 |
| `/saved` | Saved results | Placeholder | Persistence model + API | Intentional empty state; **fake "Saved" UI removed from homepage** | Beta | P1 |
| `/submit`, `/submissions` | Public submissions | Placeholder | Whole workflow | Intentional "not open yet" states | Later | P2 |
| `/journal` | Product notes | Partially functional | Posts have no detail pages | Recommend: remove from nav until posts exist, or build `/journal/[slug]` | Later | P2 |
| `/pricing` | Consumer pricing | Functional | — | — | Beta | P2 |

## Account / dashboard

| Route | Purpose | Status | Action taken | Launch req. | Priority |
|---|---|---|---|---|---|
| `/dashboard` | — | Redirect | Was blank (`return null`); now redirects to `/`. `DEFAULT_REDIRECT` changed to `/` | Blocker | P0 |
| `/settings` | Account settings | Placeholder | Intentional empty state; logout lives in the topbar | Beta | P1 |
| `/notifications` | Notifications | Placeholder | Intentional empty state | Later | P2 |
| `/support` | Support | Placeholder | Intentional empty state | Later | P2 |
| `/suspended` | Suspension notice | Functional | Real copy | Beta | P2 |

All of the above previously rendered **with no topbar at all**. The `(dashboard)`
layout now renders the site `Nav`.

## Admin

| Route | Purpose | Status | Action taken | Launch req. | Priority |
|---|---|---|---|---|---|
| `/control/admin` | Admin home | Redirect | Redirects to the evidence tool (only implemented admin surface) | Beta | P2 |
| `/control/admin/evidence` | Evidence audit | Functional | Added graceful missing-table / DB-unavailable state instead of a Prisma crash | Beta | P0 |

## Business-facing

| Route | Purpose | Status | Missing | Recommended action | Launch req. | Priority |
|---|---|---|---|---|---|---|
| `/business` | Business marketing | Functional (marketing only) | No claim/self-serve flow | Keep as marketing; CTA points to signup | Beta | P1 |
| `/business/pricing` | Business plans | Functional (marketing only) | No billing | Keep; do not imply purchase until billing exists | Beta | P1 |
| — | Business account/claim/dashboard | **Missing** | Everything | See `docs/auth-architecture-proposal.md` | Later | P1 |

Business users are **not** distinguishable from consumers today — there is one
`User` model with a `role` enum and no organization concept.

## Legal

| Route | Status | Action taken |
|---|---|---|
| `/terms`, `/privacy`, `/cookies` | Draft | Expanded into real structured drafts with a visible **"Draft — not legally reviewed"** banner |
| `/policies`, `/dmca`, `/promotion-disclosure` | Draft | Same banner via `LegalLayout` |
| `/attributions` | Functional | Complete and accurate |

**All legal documents require review by qualified counsel before launch.** They
are written by the product team and are explicitly marked as non-binding drafts.

## Known gaps deliberately left open

- **Search-results visual overhaul (Phase 9)** — the results UI is structurally
  correct and honest (states, evidence, tradeoffs, ranking transparency) but has
  not received the full premium visual pass. Highest-value remaining design work.
- **Login/signup visual overhaul (Phase 10)** — behavior is fixed; visual
  identity is still minimal.
- **Saved-result persistence** — model + API + UI.
- **`/journal` detail pages.**
