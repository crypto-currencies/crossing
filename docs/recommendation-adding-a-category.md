# Adding a recommendation category

Categories are data, not code branches. Everything a category needs lives in one
entry in `features/recommendation/categories/definitions.ts`. Adding one is a
few lines plus (optionally) some seed entities.

## 1. Add the definition

Append a `CategoryDefinition` to `CATEGORY_LIST` in
`features/recommendation/categories/definitions.ts`:

```ts
{
  id: "vpn-tools",                       // kebab-case, unique, stable
  name: "VPN tools",
  aliases: ["vpn", "vpn service", "vpn provider"], // lowercased phrases → ./detect()
  attributes: [priceMonthly, hasFreePlan, platforms, targetUser],
  weights: { ...BASE_WEIGHTS, generalQuality: 0.24, reviewConfidence: 0.14 },
  supportedSources: ["official", "trustpilot", "reddit"],
  stalenessThresholdDays: 90,
  categoryAverageRating: 0.79,           // 0..1 prior for Bayesian adjustment
},
```

Field notes:

- **`aliases`** drive keyword category detection (`detectCategory`). Add the
  phrases real users type. Longer, more specific aliases win ties.
- **`attributes`** — reuse the shared builders at the top of the file
  (`priceMonthly`, `hasFreePlan`, `openSource`, `selfHostable`, `platforms`,
  `targetUser`) or add a new `CategoryAttribute`. Each attribute declares whether
  it is `hardFilterable` (a hard constraint may target it), `preferenceable`
  (a soft/negative preference may target it), and `searchable` (query relevance
  considers it).
- **`weights`** — start from `BASE_WEIGHTS` and nudge. Keep the eight positive
  components summing to roughly `1.0` (a test enforces `0.8–1.2`); `riskPenalty`
  is a separate subtractive band. Raise `freshness` for fast-moving categories,
  `generalQuality`/`riskPenalty` for reliability-critical ones.
- **`supportedSources`** — which `EvidenceSourceType`s count toward source
  diversity for this category (allowlist only — see the source doc).
- **`stalenessThresholdDays`** — evidence older than this is penalized and warned.
- **`categoryAverageRating`** — the Bayesian prior (0..1). New/low-volume tools
  in this category are pulled toward this value.

## 2. (Optional) add seed entities

To make the category rankable in Phase 1, add fictional entities to
`features/recommendation/fixtures.ts` with `categoryId: "vpn-tools"` and enough
evidence to score. In later phases these come from the database instead.

## 3. Add a parser hint if needed

The deterministic parser (`features/recommendation/query/parser.ts`) extracts
hard constraints from attribute keywords it knows (`open source`, `self-host`,
platform names, price). If your category introduces a brand-new hard-filterable
attribute, add a small extraction rule in `extractConstraints`. This is optional
— category detection and generic scoring work without it.

## 4. Validate

```
npm run typecheck
npm run lint
npm test          # the "all seven MVP categories" test also guards weight sums
```

Add a case to `features/recommendation/categories.test.ts` asserting your new
category resolves from a representative query.
