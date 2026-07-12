# Crossing.dev — product scope

## The promise

Crossing.dev helps people find products, services, tools, and communities
worth their time. It is a discovery platform, not a profile-link platform, a
social network, a marketplace, a messaging platform, or an enterprise SaaS
dashboard.

## MVP user experience

A visitor lands on the site and can browse **listings** organized into
**categories**. They can search for a listing, open a **listing page** to see
its details, and — once signed in — **save** listings, **vote**/recommend on
ones they like, and **submit** a new listing for others to discover.
Submissions go through **moderation** before they appear publicly. Basic
**accounts** (Google OAuth or email/password) are all that's needed to
participate.

## Terminology

- **Listing** — a single discoverable thing (a product, service, tool, or
  community). The core unit of the product.
- **Category** — a top-level grouping of listings (e.g. "Design tools",
  "Newsletters"). Listings belong to one or more categories.
- **Collection** — a curated, ordered set of listings assembled around a
  theme (e.g. "Best free design tools"). Distinct from a category: a
  collection is editorial/curated, a category is structural.
- **Submission** — the act (and the resulting record) of a user proposing a
  new listing. A submission is pending until moderation approves or rejects
  it, at which point it becomes (or fails to become) a listing.
- **Vote** — a lightweight positive signal a user gives a listing ("this is
  good/relevant"). Feeds the ranking score. Not a star rating or review.
- **Save** — a private bookmark: a user keeping track of a listing for later,
  with no public or ranking signal attached.
- **Ranking score** — the computed value used to order listings within a
  category or search result, combining quality, relevance, freshness, and
  community signals (votes, saves). Recomputed periodically, not read
  directly from a single field a user can see.

## Included in v1

- Account creation and login (Google OAuth, email/password)
- Basic account settings (name, password, sessions, notification prefs)
- Simple admin authorization (verify/suspend users, audit log, role grants)
- The infrastructure this document's sibling, `architecture.md`, describes as
  "retained" — auth, admin, email, rate limiting, error monitoring, file
  storage, the UI system

## Explicitly deferred (not built yet)

- Listings, categories, collections, submissions, votes, saves, search, and
  the ranking algorithm itself — none of this exists in the codebase yet.
  This document defines the target; implementation is future work.
- Any social-graph feature (following, messaging, profile pages)
- Payments or a marketplace of any kind
- Advanced authentication (2FA, magic links, passkeys) unless a concrete need
  arises
- Support tickets / in-app helpdesk (use a plain support email for now)
- Notifications beyond the minimal system-generated kind already wired up
  (e.g. "your submission was approved") — no in-app activity feed
