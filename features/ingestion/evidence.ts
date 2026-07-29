/**
 * Normalize extracted page facts into engine-usable attributes + provenance +
 * a recommendation Evidence record.
 *
 * Only a conservative set of FACTUAL attributes is mapped into the ranking-usable
 * space: hasFreePlan, priceMonthly, platforms. Other extracted facts (free trial,
 * integrations, features) are preserved as provenance/attributes for audit but
 * are not category-ranking inputs. Official-site evidence NEVER produces a rating.
 */

import type { Evidence } from "@/features/recommendation/evidence/types";
import type { ExtractedEvidence } from "./extract";
import { normalizePricing, type PricingModel } from "./pricing";
import type { AttributeProvenance } from "./snapshot";
import { fingerprint } from "./snapshot";

/** Attribute keys official-site evidence is allowed to assert into ranking. */
export const RANKING_FACTUAL_ATTRIBUTES = ["priceMonthly", "hasFreePlan", "platforms"] as const;

export interface NormalizedEvidence {
  attributes: Record<string, string | number | boolean>;
  provenance: AttributeProvenance[];
  pricing: PricingModel;
  /** 0..1 confidence for the source as a whole. */
  confidence: number;
}

/**
 * Merge per-page extractions (homepage, pricing, docs, …) into one normalized
 * evidence set. Later pages fill gaps; a higher-confidence method wins ties.
 */
export function normalizeExtractions(
  pages: { url: string; evidence: ExtractedEvidence }[]
): NormalizedEvidence {
  const attributes: Record<string, string | number | boolean> = {};
  const provenance: AttributeProvenance[] = [];
  const confidences: number[] = [];

  const record = (
    attribute: string,
    value: string | number | boolean,
    method: AttributeProvenance["method"],
    sourceUrl: string,
    sourceText: string,
    confidence: number
  ) => {
    // Keep the highest-confidence assertion per attribute.
    const existing = provenance.find((p) => p.attribute === attribute);
    if (existing && existing.confidence >= confidence) return;
    if (existing) {
      provenance.splice(provenance.indexOf(existing), 1);
    }
    attributes[attribute] = value;
    provenance.push({
      attribute,
      value,
      method,
      sourceUrl,
      sourceText,
      confidence,
      fingerprint: fingerprint({ attribute, value, sourceText }),
    });
    confidences.push(confidence);
  };

  // Pricing is normalized from the union of page signals (pricing page matters most).
  const merged = mergeExtracted(pages.map((p) => p.evidence));
  const pricing = normalizePricing(merged);
  const pricingUrl = pages.find((p) => /pricing/i.test(p.url))?.url ?? pages[0]?.url ?? "";

  if (pricing.hasFreePlan != null) {
    record("hasFreePlan", pricing.hasFreePlan, merged.hasFreePlan?.method ?? "semantic", pricingUrl, pricing.supportingText[0] ?? "free plan", pricing.confidence);
  }
  if (pricing.hasFreeTrial != null) {
    record("hasFreeTrial", pricing.hasFreeTrial, merged.hasFreeTrial?.method ?? "semantic", pricingUrl, "free trial", pricing.confidence);
  }
  if (pricing.minMonthly != null && (pricing.kind === "fixed_monthly" || pricing.kind === "per_user_monthly" || pricing.kind === "freemium")) {
    record("priceMonthly", pricing.minMonthly, "json-ld", pricingUrl, pricing.supportingText.join(" · ") || "monthly price", pricing.confidence);
  }

  // Platforms + informational facts, attributed to the page they came from.
  for (const { url, evidence } of pages) {
    if (evidence.platforms) {
      record("platforms", evidence.platforms.value.join(","), evidence.platforms.method, url, evidence.platforms.sourceText, evidence.platforms.confidence);
    }
    if (evidence.integrations) {
      record("integrations", evidence.integrations.value.join(","), evidence.integrations.method, url, evidence.integrations.sourceText, evidence.integrations.confidence);
    }
    if (evidence.features) {
      record("features", evidence.features.value.join(","), evidence.features.method, url, evidence.features.sourceText, evidence.features.confidence);
    }
  }

  const confidence = confidences.length ? Math.min(0.95, confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0.2;
  return { attributes, provenance, pricing, confidence };
}

/** Combine several page extractions into one, preferring the highest-confidence fact. */
function mergeExtracted(list: ExtractedEvidence[]): ExtractedEvidence {
  const base: ExtractedEvidence = {
    name: null, canonicalUrl: null, description: null, logoUrl: null, title: null,
    hasFreePlan: null, hasFreeTrial: null, billingPeriods: null, platforms: null,
    integrations: null, features: null, docsLinks: null, contactLinks: null,
    softwareFields: null, lastModified: null, priceStatements: [],
  };
  const keys: (keyof ExtractedEvidence)[] = [
    "name", "canonicalUrl", "description", "logoUrl", "title", "hasFreePlan", "hasFreeTrial",
    "billingPeriods", "platforms", "integrations", "features", "docsLinks", "contactLinks",
    "softwareFields", "lastModified",
  ];
  for (const ev of list) {
    for (const k of keys) {
      const incoming = ev[k] as { confidence: number } | null;
      const current = base[k] as { confidence: number } | null;
      if (incoming && (!current || incoming.confidence > current.confidence)) {
        // @ts-expect-error index assignment across the union is safe here
        base[k] = incoming;
      }
    }
    base.priceStatements.push(...ev.priceStatements);
  }
  return base;
}

/** Build a recommendation Evidence record from normalized official-site data. */
export function toRecommendationEvidence(
  normalized: NormalizedEvidence,
  sourceUrl: string,
  retrievedAt: string
): Evidence {
  return {
    sourceType: "official",
    sourceUrl,
    retrievedAt,
    // Official-site evidence is factual only — it NEVER asserts a consumer rating.
    rating: null,
    ratingScale: null,
    reviewCount: 0,
    attributes: { ...normalized.attributes },
    confidence: normalized.confidence,
    // The domain is approved for this entity, so entity match is certain.
    entityMatchConfidence: 1,
  };
}
