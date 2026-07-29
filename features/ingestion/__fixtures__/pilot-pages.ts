/**
 * Sanitized HTML fixtures modeling the real-world patterns of the three pilot
 * analytics vendors. These are hand-written structural approximations — NOT
 * copied production HTML — used only to regression-test the generic extractor
 * against patterns we expect from these sites (JSON-LD offers, "Free" plan
 * cards, per-user vs flat, annual-only display, contact-sales, free trial).
 */

// Plausible-style: JSON-LD SoftwareApplication with a free trial + monthly offer,
// free plan absent, web/api platforms.
export const PLAUSIBLE_HOME = `<!doctype html><html><head>
<title>Plausible Analytics — Privacy-friendly web analytics</title>
<link rel="canonical" href="https://plausible.io/">
<meta name="description" content="Open-source, privacy-friendly web analytics. No cookies, GDPR compliant.">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","name":"Plausible Analytics","url":"https://plausible.io","logo":{"url":"https://plausible.io/logo.png"}},
 {"@type":"SoftwareApplication","name":"Plausible Analytics","applicationCategory":"Web analytics",
  "operatingSystem":"Web, API","offers":{"@type":"Offer","price":"9","priceCurrency":"USD",
   "priceSpecification":{"@type":"UnitPriceSpecification","price":"9","priceCurrency":"USD","billingDuration":"month"}}}
]}
</script></head><body>
<h1>Plausible Analytics</h1>
<p>Start your 30-day free trial. No credit card required.</p>
<ul><li>Cookie-free tracking</li><li>Open source</li><li>Self-hostable</li></ul>
<a href="/docs">Documentation</a><a href="/contact">Contact</a>
<section><h2>Pricing</h2><p>Plans from $9/mo, billed monthly or annually.</p></section>
</body></html>`;

// Fathom-style pricing page: flat monthly with an annual option, a 7-day free
// trial, NO free plan.
export const FATHOM_PRICING = `<!doctype html><html><head>
<title>Pricing — Fathom Analytics</title>
<link rel="canonical" href="https://usefathom.com/pricing">
<meta property="og:site_name" content="Fathom Analytics">
<meta property="og:description" content="Simple, privacy-first website analytics.">
</head><body>
<h1>Pricing</h1>
<div><h3>Starter</h3><p>$15/mo</p><p>or $150/yr billed annually</p></div>
<p>Every plan includes a 7-day free trial. There is no free plan.</p>
<a href="/docs">Docs</a>
</body></html>`;

// Matomo-style: a free self-hosted tier ("Free"), a paid monthly cloud tier, and
// an enterprise contact-sales tier, plus a 21-day free trial.
export const MATOMO_PRICING = `<!doctype html><html><head>
<title>Pricing — Matomo</title>
<link rel="canonical" href="https://matomo.org/pricing/">
<meta name="description" content="Matomo: open-source web analytics, self-hosted or cloud.">
</head><body>
<h1>Matomo pricing</h1>
<div class="tier"><h3>On-Premise</h3><p>Free</p><p>Self-host Matomo for free.</p></div>
<div class="tier"><h3>Cloud</h3><p>From $19/mo</p><p>21-day free trial.</p></div>
<div class="tier"><h3>Enterprise</h3><p>Contact us for pricing</p></div>
<a href="/docs">Developer docs</a>
</body></html>`;

// Per-user pricing pattern (generic).
export const PER_USER_PRICING = `<title>Pricing</title><body>
<h3>Team</h3><p>$9 per user / month</p><p>Billed monthly.</p></body>`;

// Annual-only display (no monthly equivalent stated).
export const ANNUAL_ONLY = `<title>Pricing</title><body>
<h3>Pro</h3><p>$120 / year</p><p>Billed annually.</p></body>`;
