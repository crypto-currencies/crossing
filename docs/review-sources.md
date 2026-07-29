# Independent review & reputation evidence

How Crossing establishes reputation, and why an official website can never
contribute to it.

## The core rule

| Fact | Official site may establish | Independent review source may establish |
|---|---|---|
| Name, pricing, features, platforms | ✅ | — |
| Location, hours, amenities, availability | ✅ | — |
| Official capabilities, documentation | ✅ | — |
| **Rating** | ❌ | ✅ |
| **Review count** | ❌ | ✅ |
| **Customer sentiment** | ❌ | ✅ |
| **Reputation / trust / popularity** | ❌ | ✅ |

This is enforced structurally, at four independent layers — not by convention:

1. **Ingestion** (`features/ingestion/evidence.ts`) hardcodes
   `rating: null, reviewCount: 0` for official-site evidence.
2. **Source independence** (`features/search/sources/types.ts`)
   — `enforceIndependence` strips ratings from any `vendor` source.
3. **Source class** (`features/search/evidence/classes.ts`)
   — `reputationFrom()` filters the `official` class on its first line;
   `stripOfficialReputation` catches anything that slips through by another path.
4. **Adapter registration** (`features/search/reviews/types.ts`)
   — `assertIndependentProvider` throws if a non-independent adapter is
   registered, so the rule cannot be broken by a future code change.

A vendor's testimonials page, star widget, or `aggregateRating` JSON-LD is
marketing. It cannot reach reputation scoring by any route.

## Implemented provider

**Trustpilot** (`features/search/reviews/trustpilot.ts`) — chosen because it is
the strongest fit for the categories that are actually live: it covers online
businesses and software companies, exposes stable Business Unit IDs, matches on
**domain** (the identity key our entities already use), and permits aggregate
display with attribution.

| | |
|---|---|
| **Credential** | `TRUSTPILOT_API_KEY` |
| **Access** | Official API (`api.trustpilot.com/v1`). No HTML parsing anywhere. |
| **Matching** | Domain only, verified against the unit's own `websiteUrl` |
| **Storage** | Aggregates ✅ · review text ❌ · derived topics ✅ · 30-day retention |
| **Attribution** | Name + backlink (new tab) + rating + review count + retrieved date |
| **Disable** | `TRUSTPILOT_ENABLED=off` |

`fetchReviewEvidence` is deliberately **not implemented**: the public tier does
not permit retaining review text, so deriving topic aggregates from it would
breach the terms. Topics come back empty rather than fabricated from the rating.

## Documented, not implemented

No stubs, no fake adapters. Each is documented in
`features/search/reviews/providers.ts` with full terms, and absent from
`buildReviewAdapters()`.

| Provider | Blocker |
|---|---|
| Yelp | Needs local-business categories + review of the 24-hour caching limit |
| Google Places | Needs local-business categories + billed GCP project + 30-day caching review |
| App Store / Google Play | Needs a mobile-app category. **Both APIs only cover apps you own**, not arbitrary third-party apps |
| G2 | Requires a negotiated commercial partnership. Best category fit for our software categories |
| Capterra | Requires Gartner Digital Markets licensing |
| Tripadvisor / OpenTable | Needs travel/hospitality/restaurant categories |

⚠️ Terms summaries reflect published documentation and are **not legal advice**.
Confirm current terms before enabling any provider.

## Entity matching

Ladder, strongest first. `name-only` sits at `0.3` — **below every usable
threshold by construction**, so a name resemblance can never attach reviews.

```
provider-id       1.00
verified-domain   0.97   ← Trustpilot uses this
official-website  0.95
exact-address     0.92
phone             0.90
coordinates       0.85
name-location     0.80
name-only         0.30   ← always rejected
```

`MIN_RANKING_MATCH_CONFIDENCE = 0.85`. Below it, review data is retained for
audit but produces **no `Evidence` record at all** — it cannot influence a score
by any path. Attaching a competitor's reviews to a product is worse than having
none.

## Normalization

The property under test: **a 5.0 from 3 reviews must not beat a 4.7 from
thousands.** No arithmetic average appears anywhere.

- **Scale normalization** — 4/5, 8/10, 80/100 all become 0.8.
- **Bayesian shrinkage** — prior weight 50 "virtual reviews"; a thin rating is
  pulled toward the category average.
- **Volume confidence** — log-scaled, saturating at 1,000 reviews.
- **Recency weighting** — exponential decay, 365-day half-life.
- **Provider reliability** — per-provider trust constant.
- **Match confidence** — multiplied in, so a weak match dilutes the contribution.
- **Suspicion penalties** — fire only on distributions too extreme to be genuine
  (>95% 5★ with <2% middle, on ≥30 reviews). Deliberately conservative: a
  genuinely well-liked product must not be punished.

Weights **multiply** rather than average, so a weak signal on any axis pulls the
whole contribution down.

## Multi-source

Sources are always preserved individually. `crossSourceAgreement` below `0.85`
sets `sourcesDisagree: true` and adds a note — disagreement is a finding to
report, never noise to average away. Excluded sources stay visible in the
breakdown with the reason for their exclusion.

## Unknown ≠ absent

The distinction the whole availability system exists to preserve:

- **Provider ran, found nothing** → `checkedAndAbsent: true` → "no reviews found"
- **Provider could not run** → `anyProviderChecked: false` → *"reputation is
  unknown, not absent"*

A missing API key must never read as "this product has no reviews".

## Required owner action

**To enable reputation evidence today:**

1. Register a Trustpilot Business account
2. Request API access
3. Set `TRUSTPILOT_API_KEY`

Until then the adapter reports `missing-credentials` with that exact action, no
result carries a `reviewSummary`, `evidenceCoverage.withRatings` is `0`, and
every response warns that ranking used vendor-published facts only.
