/**
 * Evidence classes.
 *
 * Three classes, kept structurally distinct so they can never be blended by
 * accident. The rule that motivates the whole module:
 *
 *   OFFICIAL PRODUCT CLAIMS MUST NEVER GENERATE A POSITIVE REPUTATION SCORE.
 *
 * A vendor saying "loved by 10,000 teams" is marketing. A vendor embedding
 * testimonials, star widgets, or `aggregateRating` JSON-LD on its own site is
 * still marketing. `reputationFrom()` reads ONLY the independent and editorial
 * classes, so no amount of official-site data can move a reputation number.
 */

import type { Evidence, ReviewTopicAggregate } from "@/features/recommendation/evidence/types";
import { evidenceAgeDays, normalizedRating } from "@/features/recommendation/evidence/types";

export type EvidenceClass = "official" | "independent" | "editorial";

/**
 * Which class a source type belongs to. Explicit, not inferred.
 *
 * The `official` entries are vendor-controlled; nothing in that group may ever
 * carry a rating. The `independent` group is the review platforms in
 * ../reviews/ — those are the ONLY sources that can establish reputation.
 */
export const SOURCE_CLASS: Record<string, EvidenceClass> = {
  // Vendor-controlled.
  official: "official",
  pricing_page: "official",
  documentation: "official",
  // Independent review platforms.
  trustpilot: "independent",
  yelp: "independent",
  "google-places": "independent",
  "app-store": "independent",
  "google-play": "independent",
  g2: "independent",
  capterra: "independent",
  tripadvisor: "independent",
  opentable: "independent",
  app_store: "independent",
  // Editorial / community.
  github: "editorial",
  reddit: "editorial",
  editorial: "editorial",
};

export function classOf(sourceType: string): EvidenceClass {
  // Unknown sources are treated as official (the most restricted class) so a
  // new adapter cannot accidentally gain reputation weight by omission.
  return SOURCE_CLASS[sourceType] ?? "official";
}

// ─── Class 1: official factual evidence ──────────────────────────────────────

/**
 * Facts a vendor asserts about its own product. Verifiable, useful, and
 * strictly NON-REPUTATIONAL.
 */
export interface OfficialFacts {
  officialDomain: string | null;
  description: string | null;
  pricing: { monthly: number | null; hasFreePlan: boolean | null; hasFreeTrial: boolean | null };
  features: string[];
  platforms: string[];
  location: string | null;
  hours: string | null;
  amenities: string[];
  availability: string | null;
  documentationUrl: string | null;
  /** Where each fact came from. */
  sourceUrls: string[];
  retrievedAt: string | null;
}

export function officialFactsFrom(evidence: Evidence[]): OfficialFacts {
  const official = evidence.filter((e) => classOf(e.sourceType) === "official");

  const attr = <T>(key: string, coerce: (v: string | number | boolean) => T | null): T | null => {
    for (const e of official) {
      const v = e.attributes[key];
      if (v !== undefined) {
        const c = coerce(v);
        if (c !== null) return c;
      }
    }
    return null;
  };

  const list = (key: string): string[] => {
    const raw = attr<string>(key, (v) => (typeof v === "string" ? v : String(v)));
    return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  };

  const dates = official.map((e) => e.retrievedAt).filter(Boolean).sort();

  return {
    officialDomain: official[0]?.sourceUrl ?? null,
    description: attr<string>("description", (v) => (typeof v === "string" ? v : null)),
    pricing: {
      monthly: attr<number>("priceMonthly", (v) => (typeof v === "number" ? v : null)),
      hasFreePlan: attr<boolean>("hasFreePlan", (v) => (typeof v === "boolean" ? v : null)),
      hasFreeTrial: attr<boolean>("hasFreeTrial", (v) => (typeof v === "boolean" ? v : null)),
    },
    features: list("features"),
    platforms: list("platforms"),
    location: attr<string>("location", (v) => (typeof v === "string" ? v : null)),
    hours: attr<string>("hours", (v) => (typeof v === "string" ? v : null)),
    amenities: list("amenities"),
    availability: attr<string>("availability", (v) => (typeof v === "string" ? v : null)),
    documentationUrl: attr<string>("documentationUrl", (v) => (typeof v === "string" ? v : null)),
    sourceUrls: [...new Set(official.map((e) => e.sourceUrl))],
    retrievedAt: dates[dates.length - 1] ?? null,
  };
}

// ─── Class 2: independent reputation evidence ────────────────────────────────

export interface ReputationEvidence {
  /** 0..1 normalized aggregate, or null when no independent source rated it. */
  aggregateRating: number | null;
  reviewCount: number;
  /** Age in days of the freshest independent review data. */
  recencyDays: number | null;
  topics: ReviewTopicAggregate[];
  commonPraise: string[];
  commonComplaints: string[];
  /** Distinct INDEPENDENT source types. Official sources are never counted. */
  sourceDiversity: number;
  sourceTypes: string[];
}

/** Sentiment at/above this reads as praise; at/below its negation, a complaint. */
const PRAISE_THRESHOLD = 0.3;

/**
 * Build the reputation picture from INDEPENDENT + EDITORIAL evidence only.
 *
 * Official evidence is filtered out on the first line. This is the single
 * chokepoint the "no marketing as reputation" rule depends on.
 */
export function reputationFrom(evidence: Evidence[], now: Date): ReputationEvidence {
  const reputational = evidence.filter((e) => classOf(e.sourceType) !== "official");

  let weightedSum = 0;
  let weightSum = 0;
  let reviewCount = 0;
  const topics: ReviewTopicAggregate[] = [];
  const ages: number[] = [];

  for (const e of reputational) {
    const norm = normalizedRating(e.rating, e.ratingScale);
    if (norm !== null) {
      const w = clamp01(e.confidence) * clamp01(e.entityMatchConfidence) * (e.reviewCount + 1);
      weightedSum += norm * w;
      weightSum += w;
    }
    reviewCount += e.reviewCount;
    topics.push(...(e.reviewTopics ?? []));
    const age = evidenceAgeDays(e, now);
    if (Number.isFinite(age)) ages.push(age);
  }

  const merged = mergeTopics(topics);
  const sourceTypes = [...new Set(reputational.map((e) => e.sourceType))].sort();

  return {
    aggregateRating: weightSum > 0 ? weightedSum / weightSum : null,
    reviewCount,
    recencyDays: ages.length ? Math.min(...ages) : null,
    topics: merged,
    commonPraise: merged.filter((t) => t.sentiment >= PRAISE_THRESHOLD).map((t) => t.topic),
    commonComplaints: merged.filter((t) => t.sentiment <= -PRAISE_THRESHOLD).map((t) => t.topic),
    sourceDiversity: sourceTypes.length,
    sourceTypes,
  };
}

/** Mention-weighted average per topic, so a 500-review topic outweighs a 3. */
function mergeTopics(topics: ReviewTopicAggregate[]): ReviewTopicAggregate[] {
  const byTopic = new Map<string, { weighted: number; mentions: number }>();
  for (const t of topics) {
    const key = t.topic.toLowerCase();
    const acc = byTopic.get(key) ?? { weighted: 0, mentions: 0 };
    acc.weighted += t.sentiment * Math.max(1, t.mentions);
    acc.mentions += Math.max(1, t.mentions);
    byTopic.set(key, acc);
  }
  return [...byTopic.entries()]
    .map(([topic, a]) => ({ topic, sentiment: a.weighted / a.mentions, mentions: a.mentions }))
    .sort((a, b) => b.mentions - a.mentions || a.topic.localeCompare(b.topic));
}

// ─── Class 3: editorial / community evidence ─────────────────────────────────

export interface EditorialEvidence {
  /** Reputable editorial reviews and specialist publications. */
  articles: { sourceType: string; url: string; retrievedAt: string }[];
  /** Community discussion threads. */
  discussions: { sourceType: string; url: string; retrievedAt: string }[];
  sourceTypes: string[];
}

const COMMUNITY_SOURCES = new Set(["reddit", "github"]);

export function editorialFrom(evidence: Evidence[]): EditorialEvidence {
  const editorial = evidence.filter((e) => classOf(e.sourceType) === "editorial");
  const pick = (e: Evidence) => ({
    sourceType: e.sourceType,
    url: e.sourceUrl,
    retrievedAt: e.retrievedAt,
  });
  return {
    articles: editorial.filter((e) => !COMMUNITY_SOURCES.has(e.sourceType)).map(pick),
    discussions: editorial.filter((e) => COMMUNITY_SOURCES.has(e.sourceType)).map(pick),
    sourceTypes: [...new Set(editorial.map((e) => e.sourceType))].sort(),
  };
}

// ─── Combined view ───────────────────────────────────────────────────────────

export interface ClassifiedEvidence {
  official: OfficialFacts;
  reputation: ReputationEvidence;
  editorial: EditorialEvidence;
  /** True when at least one non-official source contributed. */
  hasIndependent: boolean;
  /** True when an INDEPENDENT source supplied a rating. */
  hasIndependentRating: boolean;
}

export function classifyEvidence(evidence: Evidence[], now: Date): ClassifiedEvidence {
  const reputation = reputationFrom(evidence, now);
  const editorial = editorialFrom(evidence);
  return {
    official: officialFactsFrom(evidence),
    reputation,
    editorial,
    hasIndependent: reputation.sourceDiversity > 0,
    hasIndependentRating: reputation.aggregateRating !== null,
  };
}

/**
 * Strip reputation fields from evidence whose class is official.
 *
 * Belt-and-braces alongside `enforceIndependence` in ../sources/types.ts: that
 * one guards by SOURCE independence, this one by SOURCE TYPE — so an official
 * record that arrives through a non-vendor adapter is still neutralized.
 */
export function stripOfficialReputation(evidence: Evidence[]): { evidence: Evidence[]; stripped: number } {
  let stripped = 0;
  const out = evidence.map((e) => {
    if (classOf(e.sourceType) !== "official") return e;
    if (e.rating == null && e.reviewCount === 0 && !e.reviewTopics?.length) return e;
    stripped += 1;
    return { ...e, rating: null, ratingScale: null, reviewCount: 0, reviewTopics: undefined };
  });
  return { evidence: out, stripped };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}
