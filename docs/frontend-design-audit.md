# Crossing frontend design audit

## Executive summary

Crossing already had a distinctive dark, coral-accented homepage and a substantially more complete recommendation result surface than the rest of the product. The main design problem was not a lack of visual ideas; it was a lack of continuity. Search felt like a product, while Discover, Browse, Saved, Submit, and Submissions were almost identical placeholder pages. Journal entries looked like controls but were not links. The business page used unsupported performance statistics. The authentication form rendered email/password controls but intentionally did nothing on submit even though working API routes existed.

This pass keeps the existing logo, dark identity, recommendation contracts, and repaired authentication/session code. It consolidates shared product surfaces and connects UI only to existing endpoints.

## Findings

### Foundation and tokens

- `app/globals.css` had a useful color scale, but semantic tokens were incomplete. Status colors, focus rings, container sizes, section spacing, component gaps, motion timing, and search glow were still expressed as one-off values.
- The Tailwind v4 `@theme inline` font entries referenced the same CSS variables they defined. This circular form can fall back unexpectedly; literal font family names are safer with the bundled Next.js/Tailwind version.
- The accent scale was still named `sky` after the visual identity changed to coral. Renaming it would create a very large and risky mechanical diff, so this pass treats `sky-*` as the compatibility utility name and exposes semantic `--accent-*` tokens for new work.
- A large part of the homepage has page-specific CSS. It is visually successful, but should not be copied into secondary pages.

### Application shell

- The public and dashboard route groups both use the same topbar, which prevents duplicate navigation and keeps authenticated routes recoverable.
- The desktop menu had useful descriptions and keyboard dismissal, but did not expose the current section.
- Hover-opening menus are easy to use with a pointer, but active-route styling and mobile scroll locking/escape behavior were missing.
- Auth pages did not use the standard topbar by design, but their shell was only a centered logo and form, so they felt detached from the product.
- Footer links were a flat list rather than product/business/company/legal groups.

### Homepage and search

- The current homepage search already fixes the old inner input rectangle and uses a stable, non-rotating glow.
- Suggestion keyboard navigation, selected state, and a loading announcement exist.
- The suggestion panel has no persisted recent-search contract, so showing invented history would be misleading. The UI should reserve that section until a real source exists.
- The homepage examples include place-oriented demo content while the live recommendation engine currently supports software. The demo is labeled, but coverage messaging must remain prominent.
- The result experience has loading, error, unsupported, category clarification, success, evidence, tradeoff, confidence, and feedback states. Save/share are not exposed because no recommendation-to-listing persistence contract exists.

### Secondary product pages

- Discover, Browse, Saved, Submit, and Submissions all used the same placeholder component. The honesty was good; the repeated composition made the product feel unfinished.
- Existing public endpoints already provide categories and listings. Browse and Discover were not consuming them.
- An authenticated saved-listings endpoint exists. `/saved` did not consume it and therefore could not distinguish loading, logged-out, empty, error, and success states.
- Category and listing routes redirected to Browse, making otherwise valid links feel broken.
- Journal cards were non-interactive rows and had no detail route.
- The business page showed “3.2x more inquiries” and similar claims with no production analytics source.
- Business workspace concepts had no frontend foundation or honest preview state.

### Authentication

- Google availability is correctly server-provided.
- Email/password fields lacked visible labels and the submit handler was a no-op despite compatible `/api/auth/login` and `/api/auth/register` routes.
- The page did not communicate redirect context or distinguish consumer and business intent.
- Account benefits were reduced to one sentence and did not create a convincing product entry point.

### Submission and contribution

- A real authenticated listing-submission endpoint and category endpoint exist.
- The UI did not consume either contract.
- Correction, evidence-report, and category-proposal persistence contracts do not exist. These must be presented as unavailable intake types, not fake successful forms.

### Responsive and accessibility

- The homepage has extensive responsive rules, but secondary pages lacked reusable narrow-screen compositions.
- Several inputs relied on placeholders rather than labels.
- Current-section navigation state was absent.
- Loading skeletons were often `aria-hidden` without a parallel live message.
- Focus styles existed on core UI primitives but were not centralized as a semantic token.
- Dense comparison content needs horizontal-safety rules at 320–375px.

## Changes recommended and implemented

- Add semantic background, surface, border, text, accent, status, focus, shadow, container, spacing, radius, and motion tokens.
- Keep the homepage’s visual language, while using a quieter shared “product page” composition elsewhere.
- Add reusable product headers, notices, empty states, listing cards, category cards, and toolbars.
- Connect Discover/Browse to `/api/categories` and `/api/listings`.
- Connect Saved to `/api/me/saves`, using the existing session store and showing success only from server responses.
- Connect Submit to `/api/categories` and `/api/submissions`, with confirmation only after a `201` response.
- Give Journal a small explicitly labeled editorial preview fixture with real detail routes.
- Replace unsupported business statistics with capability and availability language; add an explicitly labeled workspace preview.
- Make email/password authentication submit to the existing auth endpoints and add intent-aware consumer/business presentation.
- Group footer navigation and add active-section navigation styling.

## Backend contracts assumed

- `GET /api/categories` returns `{ categories: Category[] }`.
- `GET /api/listings?category=&sort=&page=&pageSize=` returns a paged `ListingCard` result.
- `GET /api/me/saves` returns a paged `ListingCard` result and `401` when logged out.
- `POST /api/submissions` accepts `{ name, websiteUrl, tagline, description, categoryId }`.
- `POST /api/auth/login` accepts `{ identifier, password }`.
- `POST /api/auth/register` accepts `{ name, email, password }`.
- Recommendation results are not assumed to be saveable unless they resolve to a persisted listing through a backend-owned contract.

## Remaining backend dependencies

- Recent-search storage and location-aware suggestions.
- Collections, collection creation, notes, and tags.
- Recommendation save/share persistence.
- Listing correction, evidence-report, and category-proposal intake contracts.
- Journal CMS/content source.
- Business ownership, claims, analytics, promotion, billing, and team permissions.
- Local places, products, services, and other category data beyond the currently supported software definitions.
