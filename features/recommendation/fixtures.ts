/**
 * Phase-1 mock corpus.
 *
 * ⚠️ FICTIONAL DEMO DATA. Every product name, rating, and review count here is
 * invented to exercise the ranking engine — none of it describes a real
 * company or product. This stands in for the future `Entity`/`EvidenceSnapshot`
 * tables (docs/recommendation-engine-plan.md §5) so the whole pipeline can be
 * proven end-to-end with no database and no live sources.
 *
 * Timestamps are computed relative to `now` so "fresh" and "stale" stay
 * meaningful whenever the corpus is built (and deterministic in tests that pass
 * a fixed `now`).
 *
 * Deliberate edge cases embedded below (search for `EDGE:`):
 *   - high rating / very few reviews        → vellum-editor
 *   - lower rating / very high volume        → northwind-analytics
 *   - missing pricing                        → quill-notes
 *   - outdated evidence                      → nimbus-ai
 *   - conflicting sources                    → parcel-mail
 *   - fails a hard constraint (price/open)   → ironclad-host
 *   - excellent fit / weak source confidence → loom-design
 */

import type { Entity } from "./entities/types";
import type { Evidence } from "./evidence/types";
import { normalizeDomainKey } from "./entities/normalize";

const DAY_MS = 86_400_000;
function daysAgo(now: Date, n: number): string {
  return new Date(now.getTime() - n * DAY_MS).toISOString();
}

interface EvidenceSeed extends Omit<Evidence, "retrievedAt"> {
  ageDays: number;
}

interface EntitySeed {
  id: string;
  canonicalName: string;
  officialDomain: string;
  categoryId: string;
  aliases: string[];
  description: string;
  attributes: Record<string, string | number | boolean>;
  externalIds?: { sourceType: string; externalId: string; url: string }[];
  evidence: EvidenceSeed[];
  updatedDaysAgo: number;
}

function ev(seed: EvidenceSeed): Omit<Evidence, "retrievedAt"> & { ageDays: number } {
  return seed;
}

const SEEDS: EntitySeed[] = [
  // ── Developer tools ────────────────────────────────────────────────────────
  {
    id: "glyph-code",
    canonicalName: "Glyph Code",
    officialDomain: "glyphcode.dev",
    categoryId: "developer-tools",
    aliases: ["glyph", "glyph editor"],
    description: "A fast, extensible code editor with a huge extension ecosystem.",
    attributes: { priceMonthly: 0, hasFreePlan: true, openSource: true, selfHostable: false, platforms: "web,mac,windows,linux", targetUser: "individual" },
    updatedDaysAgo: 10,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://glyphcode.dev", ageDays: 12, rating: null, ratingScale: null, reviewCount: 0, attributes: { priceMonthly: 0, hasFreePlan: true }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "github", sourceUrl: "https://github.com/glyph/code", ageDays: 8, rating: 4.7, ratingScale: 5, reviewCount: 5200, attributes: { openSource: true }, confidence: 0.9, entityMatchConfidence: 1, reviewTopics: [{ topic: "performance", sentiment: 0.7, mentions: 900 }, { topic: "simplicity", sentiment: 0.4, mentions: 300 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/programming", ageDays: 20, rating: 4.6, ratingScale: 5, reviewCount: 1800, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9, reviewTopics: [{ topic: "performance", sentiment: 0.6, mentions: 200 }] }),
    ],
  },
  {
    id: "vellum-editor",
    canonicalName: "Vellum Editor",
    officialDomain: "vellum.tools",
    categoryId: "developer-tools",
    aliases: ["vellum"],
    // EDGE: near-perfect rating but almost no reviews — must NOT beat Glyph Code.
    description: "A minimalist writing-focused code editor loved by a small community.",
    attributes: { priceMonthly: 6, hasFreePlan: false, openSource: false, selfHostable: false, platforms: "mac", targetUser: "individual" },
    updatedDaysAgo: 15,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://vellum.tools", ageDays: 14, rating: 4.9, ratingScale: 5, reviewCount: 4, attributes: { priceMonthly: 6, hasFreePlan: false }, confidence: 0.9, entityMatchConfidence: 1, reviewTopics: [{ topic: "simplicity", sentiment: 0.9, mentions: 4 }] }),
    ],
  },
  {
    id: "forge-ide",
    canonicalName: "Forge IDE",
    officialDomain: "forge-ide.io",
    categoryId: "developer-tools",
    aliases: ["forge"],
    description: "A self-hostable, open-source IDE for teams that want to own their tooling.",
    attributes: { priceMonthly: 15, hasFreePlan: true, openSource: true, selfHostable: true, platforms: "web,linux,api", targetUser: "small_team" },
    updatedDaysAgo: 25,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://forge-ide.io", ageDays: 22, rating: null, ratingScale: null, reviewCount: 0, attributes: { selfHostable: true, openSource: true }, confidence: 0.9, entityMatchConfidence: 1 }),
      ev({ sourceType: "github", sourceUrl: "https://github.com/forge/ide", ageDays: 18, rating: 4.4, ratingScale: 5, reviewCount: 640, attributes: {}, confidence: 0.85, entityMatchConfidence: 1, reviewTopics: [{ topic: "reliability", sentiment: 0.3, mentions: 120 }] }),
    ],
  },

  // ── AI tools ───────────────────────────────────────────────────────────────
  {
    id: "cortex-write",
    canonicalName: "Cortex Write",
    officialDomain: "cortexwrite.ai",
    categoryId: "ai-tools",
    aliases: ["cortex"],
    description: "An AI writing assistant with a generous free tier and fast drafting.",
    attributes: { priceMonthly: 12, hasFreePlan: true, platforms: "web,api", targetUser: "individual" },
    updatedDaysAgo: 5,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://cortexwrite.ai", ageDays: 6, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true, priceMonthly: 12 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "app_store", sourceUrl: "https://apps.example/cortex", ageDays: 9, rating: 4.5, ratingScale: 5, reviewCount: 2100, attributes: {}, confidence: 0.85, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "performance", sentiment: 0.6, mentions: 400 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/artificial", ageDays: 11, rating: 4.3, ratingScale: 5, reviewCount: 700, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
    ],
  },
  {
    id: "nimbus-ai",
    canonicalName: "Nimbus AI",
    officialDomain: "nimbus.ai",
    categoryId: "ai-tools",
    aliases: ["nimbus"],
    // EDGE: outdated evidence — everything is ~200 days old, past AI's 45-day window.
    description: "An AI assistant that was popular last year; its evidence is stale.",
    attributes: { priceMonthly: 10, hasFreePlan: false, platforms: "web", targetUser: "individual" },
    updatedDaysAgo: 200,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://nimbus.ai", ageDays: 205, rating: 4.6, ratingScale: 5, reviewCount: 3400, attributes: { priceMonthly: 10 }, confidence: 0.9, entityMatchConfidence: 1, reviewTopics: [{ topic: "performance", sentiment: 0.5, mentions: 500 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/ai", ageDays: 220, rating: 4.4, ratingScale: 5, reviewCount: 1200, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
    ],
  },

  // ── Productivity tools ───────────────────────────────────────────────────────
  {
    id: "tandem-tasks",
    canonicalName: "Tandem Tasks",
    officialDomain: "tandemtasks.com",
    categoryId: "productivity-tools",
    aliases: ["tandem"],
    description: "A collaborative task manager with a strong free plan for small teams.",
    attributes: { priceMonthly: 8, hasFreePlan: true, platforms: "web,mac,windows,ios,android", targetUser: "small_team" },
    updatedDaysAgo: 12,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://tandemtasks.com", ageDays: 10, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true, priceMonthly: 8 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/tandem", ageDays: 14, rating: 4.4, ratingScale: 5, reviewCount: 3800, attributes: {}, confidence: 0.8, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "simplicity", sentiment: 0.6, mentions: 500 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/productivity", ageDays: 25, rating: 4.2, ratingScale: 5, reviewCount: 900, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
    ],
  },
  {
    id: "quill-notes",
    canonicalName: "Quill Notes",
    officialDomain: "quillnotes.app",
    categoryId: "productivity-tools",
    aliases: ["quill"],
    // EDGE: missing pricing — no priceMonthly anywhere. Budget queries can't verify it.
    description: "A fast note-taking app; pricing is not published publicly.",
    attributes: { hasFreePlan: true, platforms: "web,ios", targetUser: "individual" },
    updatedDaysAgo: 30,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://quillnotes.app", ageDays: 28, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true }, confidence: 0.9, entityMatchConfidence: 1 }),
      ev({ sourceType: "app_store", sourceUrl: "https://apps.example/quill", ageDays: 30, rating: 4.5, ratingScale: 5, reviewCount: 1500, attributes: {}, confidence: 0.8, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "performance", sentiment: 0.7, mentions: 300 }] }),
    ],
  },
  {
    id: "beacon-pm",
    canonicalName: "Beacon PM",
    officialDomain: "beaconpm.io",
    categoryId: "productivity-tools",
    aliases: ["beacon"],
    description: "An enterprise project-management suite with deep reporting.",
    attributes: { priceMonthly: 29, hasFreePlan: false, platforms: "web,api", targetUser: "enterprise" },
    updatedDaysAgo: 18,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://beaconpm.io", ageDays: 16, rating: null, ratingScale: null, reviewCount: 0, attributes: { priceMonthly: 29, hasFreePlan: false }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/beacon", ageDays: 20, rating: 4.1, ratingScale: 5, reviewCount: 5200, attributes: {}, confidence: 0.8, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "reliability", sentiment: 0.5, mentions: 800 }] }),
    ],
  },

  // ── Design tools ─────────────────────────────────────────────────────────────
  {
    id: "canvas-forge",
    canonicalName: "Canvas Forge",
    officialDomain: "canvasforge.com",
    categoryId: "design-tools",
    aliases: ["canvas"],
    description: "A collaborative interface-design tool with a capable free plan.",
    attributes: { priceMonthly: 12, hasFreePlan: true, platforms: "web,mac,windows", targetUser: "small_team" },
    updatedDaysAgo: 14,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://canvasforge.com", ageDays: 12, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true, priceMonthly: 12 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/design", ageDays: 18, rating: 4.6, ratingScale: 5, reviewCount: 4200, attributes: {}, confidence: 0.75, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "performance", sentiment: 0.5, mentions: 600 }] }),
      ev({ sourceType: "app_store", sourceUrl: "https://apps.example/canvas", ageDays: 22, rating: 4.5, ratingScale: 5, reviewCount: 2600, attributes: {}, confidence: 0.8, entityMatchConfidence: 0.95 }),
    ],
  },
  {
    id: "loom-design",
    canonicalName: "Loom Design",
    officialDomain: "loomdesign.studio",
    categoryId: "design-tools",
    aliases: ["loom studio"],
    // EDGE: excellent attribute fit, but a single low-confidence source.
    description: "A promising design tool with a great free tier but thin, uncertain sourcing.",
    attributes: { priceMonthly: 0, hasFreePlan: true, platforms: "web,mac,windows,linux", targetUser: "small_team" },
    updatedDaysAgo: 40,
    evidence: [
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/design", ageDays: 35, rating: 4.8, ratingScale: 5, reviewCount: 60, attributes: { hasFreePlan: true, priceMonthly: 0 }, confidence: 0.5, entityMatchConfidence: 0.35, reviewTopics: [{ topic: "simplicity", sentiment: 0.8, mentions: 30 }] }),
    ],
  },

  // ── Hosting platforms ────────────────────────────────────────────────────────
  {
    id: "driftdeploy",
    canonicalName: "DriftDeploy",
    officialDomain: "driftdeploy.com",
    categoryId: "hosting-platforms",
    aliases: ["drift"],
    description: "A developer-friendly hosting platform with instant deploys and a free tier.",
    attributes: { priceMonthly: 20, hasFreePlan: true, selfHostable: false, platforms: "web,cli,api", targetUser: "startup" },
    updatedDaysAgo: 8,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://driftdeploy.com", ageDays: 7, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true, priceMonthly: 20 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/drift", ageDays: 12, rating: 4.5, ratingScale: 5, reviewCount: 6100, attributes: {}, confidence: 0.85, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "reliability", sentiment: 0.6, mentions: 900 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/webdev", ageDays: 16, rating: 4.4, ratingScale: 5, reviewCount: 2200, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
      ev({ sourceType: "documentation", sourceUrl: "https://driftdeploy.com/docs", ageDays: 9, rating: null, ratingScale: null, reviewCount: 0, attributes: {}, confidence: 0.9, entityMatchConfidence: 1 }),
    ],
  },
  {
    id: "ironclad-host",
    canonicalName: "Ironclad Host",
    officialDomain: "ironcladhost.com",
    categoryId: "hosting-platforms",
    aliases: ["ironclad"],
    // EDGE: fails hard constraints — expensive ($120) and not open-source.
    description: "A premium managed-hosting platform aimed at large enterprises.",
    attributes: { priceMonthly: 120, hasFreePlan: false, selfHostable: false, openSource: false, platforms: "web,api", targetUser: "enterprise" },
    updatedDaysAgo: 20,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://ironcladhost.com", ageDays: 18, rating: null, ratingScale: null, reviewCount: 0, attributes: { priceMonthly: 120, hasFreePlan: false }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/ironclad", ageDays: 24, rating: 4.7, ratingScale: 5, reviewCount: 3300, attributes: {}, confidence: 0.85, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "reliability", sentiment: 0.8, mentions: 700 }] }),
    ],
  },
  {
    id: "helmport",
    canonicalName: "Helmport",
    officialDomain: "helmport.io",
    categoryId: "hosting-platforms",
    aliases: ["helm port"],
    description: "An open-source, self-hostable platform-as-a-service you can run anywhere.",
    attributes: { priceMonthly: 0, hasFreePlan: true, selfHostable: true, openSource: true, platforms: "linux,cli,api", targetUser: "small_team" },
    updatedDaysAgo: 22,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://helmport.io", ageDays: 20, rating: null, ratingScale: null, reviewCount: 0, attributes: { selfHostable: true, openSource: true, priceMonthly: 0 }, confidence: 0.9, entityMatchConfidence: 1 }),
      ev({ sourceType: "github", sourceUrl: "https://github.com/helmport/helmport", ageDays: 15, rating: 4.5, ratingScale: 5, reviewCount: 1900, attributes: {}, confidence: 0.85, entityMatchConfidence: 1, reviewTopics: [{ topic: "reliability", sentiment: 0.4, mentions: 220 }] }),
    ],
  },

  // ── Email platforms ──────────────────────────────────────────────────────────
  {
    id: "postwright",
    canonicalName: "Postwright",
    officialDomain: "postwright.com",
    categoryId: "email-platforms",
    aliases: ["post wright"],
    description: "A transactional + marketing email platform with strong deliverability.",
    attributes: { priceMonthly: 15, hasFreePlan: true, platforms: "web,api", targetUser: "startup" },
    updatedDaysAgo: 11,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://postwright.com", ageDays: 10, rating: null, ratingScale: null, reviewCount: 0, attributes: { priceMonthly: 15, hasFreePlan: true }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/postwright", ageDays: 14, rating: 4.3, ratingScale: 5, reviewCount: 4700, attributes: {}, confidence: 0.85, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "reliability", sentiment: 0.5, mentions: 600 }] }),
    ],
  },
  {
    id: "parcel-mail",
    canonicalName: "Parcel Mail",
    officialDomain: "parcelmail.io",
    categoryId: "email-platforms",
    aliases: ["parcel"],
    // EDGE: conflicting sources — the two sources disagree on priceMonthly (9 vs 15).
    description: "A newsletter platform whose public pricing sources disagree.",
    attributes: { priceMonthly: 9, hasFreePlan: true, platforms: "web", targetUser: "individual" },
    updatedDaysAgo: 26,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://parcelmail.io", ageDays: 24, rating: null, ratingScale: null, reviewCount: 0, attributes: { priceMonthly: 9, hasFreePlan: true }, confidence: 0.9, entityMatchConfidence: 1 }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/emailmarketing", ageDays: 28, rating: 4.0, ratingScale: 5, reviewCount: 500, attributes: { priceMonthly: 15 }, confidence: 0.6, entityMatchConfidence: 0.85, reviewTopics: [{ topic: "simplicity", sentiment: 0.3, mentions: 60 }] }),
    ],
  },

  // ── Analytics tools ────────────────────────────────────────────────────────
  {
    id: "tally-metrics",
    canonicalName: "Tally Metrics",
    officialDomain: "tallymetrics.com",
    categoryId: "analytics-tools",
    aliases: ["tally"],
    description: "A privacy-friendly, open-source, self-hostable analytics tool.",
    attributes: { priceMonthly: 9, hasFreePlan: true, openSource: true, selfHostable: true, platforms: "web,api", targetUser: "startup" },
    updatedDaysAgo: 9,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://tallymetrics.com", ageDays: 8, rating: null, ratingScale: null, reviewCount: 0, attributes: { openSource: true, selfHostable: true, hasFreePlan: true, priceMonthly: 9 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "github", sourceUrl: "https://github.com/tally/metrics", ageDays: 6, rating: 4.7, ratingScale: 5, reviewCount: 3100, attributes: {}, confidence: 0.9, entityMatchConfidence: 1, reviewTopics: [{ topic: "simplicity", sentiment: 0.7, mentions: 400 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/analytics", ageDays: 14, rating: 4.5, ratingScale: 5, reviewCount: 1100, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
    ],
  },
  {
    id: "northwind-analytics",
    canonicalName: "Northwind Analytics",
    officialDomain: "northwindanalytics.com",
    categoryId: "analytics-tools",
    aliases: ["northwind"],
    // EDGE: lower rating but very high review volume — a proven, if divisive, incumbent.
    description: "A long-established analytics suite with a large but mixed user base.",
    attributes: { priceMonthly: 0, hasFreePlan: true, openSource: false, selfHostable: false, platforms: "web,api", targetUser: "enterprise" },
    updatedDaysAgo: 16,
    evidence: [
      ev({ sourceType: "official", sourceUrl: "https://northwindanalytics.com", ageDays: 14, rating: null, ratingScale: null, reviewCount: 0, attributes: { hasFreePlan: true, priceMonthly: 0 }, confidence: 0.95, entityMatchConfidence: 1 }),
      ev({ sourceType: "trustpilot", sourceUrl: "https://trustpilot.example/northwind", ageDays: 18, rating: 3.9, ratingScale: 5, reviewCount: 9000, attributes: {}, confidence: 0.85, entityMatchConfidence: 0.95, reviewTopics: [{ topic: "simplicity", sentiment: -0.2, mentions: 1500 }, { topic: "reliability", sentiment: 0.4, mentions: 1200 }] }),
      ev({ sourceType: "reddit", sourceUrl: "https://reddit.com/r/analytics", ageDays: 21, rating: 3.7, ratingScale: 5, reviewCount: 2400, attributes: {}, confidence: 0.7, entityMatchConfidence: 0.9 }),
    ],
  },
];

/** Build the mock entity corpus, with evidence timestamps relative to `now`. */
export function buildFixtures(now: Date = new Date()): Entity[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    canonicalName: seed.canonicalName,
    officialDomain: seed.officialDomain,
    domainKey: normalizeDomainKey(seed.officialDomain),
    categoryId: seed.categoryId,
    aliases: seed.aliases,
    description: seed.description,
    attributes: seed.attributes,
    externalIds: seed.externalIds ?? [],
    evidence: seed.evidence.map(({ ageDays, ...rest }) => ({ ...rest, retrievedAt: daysAgo(now, ageDays) })),
    lastUpdatedAt: daysAgo(now, seed.updatedDaysAgo),
  }));
}

/** Convenience: only the entities in a given category. */
export function fixturesForCategory(categoryId: string, now: Date = new Date()): Entity[] {
  return buildFixtures(now).filter((e) => e.categoryId === categoryId);
}
