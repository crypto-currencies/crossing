/**
 * Canonical production entities (Part 6).
 *
 * These are REAL vendors, kept deliberately separate from the fictional
 * `features/recommendation/fixtures.ts` demo corpus. Only rows created from this
 * list are `source: CANONICAL`, and only `status: ACTIVE` ones are retrievable
 * for production ranking.
 *
 * Status reflects EVIDENCE READINESS, verified by the ingestion pilot
 * (docs/ingestion.md → Phase 3):
 *   - Fathom  → ready   (priceMonthly + platforms from JSON-LD)
 *   - Matomo  → ready   (free plan + platforms from JSON-LD)
 *   - Plausible → needs-review (platforms only, low-confidence fallback)
 *
 * Attributes here carry ONLY identity + facts already confirmed by official
 * evidence. Nothing is invented: no ratings, no review counts, no scores.
 */

export type CanonicalStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED" | "CLOSED";

export interface CanonicalEntitySeed {
  /** Stable public key — matches the ingestion registry entityId. */
  key: string;
  canonicalName: string;
  categoryId: string;
  officialDomain: string;
  description: string;
  status: CanonicalStatus;
  aliases: string[];
  /** Only evidence-confirmed factual attributes. */
  attributes: Record<string, string | number | boolean>;
  /** Why this status — recorded so the decision is auditable. */
  readinessNote: string;
}

export const CANONICAL_ENTITIES: CanonicalEntitySeed[] = [
  {
    key: "fathom-analytics",
    canonicalName: "Fathom Analytics",
    categoryId: "analytics-tools",
    officialDomain: "usefathom.com",
    description: "Privacy-focused website analytics.",
    status: "ACTIVE",
    aliases: ["fathom"],
    attributes: { priceMonthly: 15, platforms: "web", hasFreeTrial: true },
    readinessNote: "Readiness=ready: priceMonthly + platforms extracted from JSON-LD on the official site.",
  },
  {
    key: "matomo",
    canonicalName: "Matomo",
    categoryId: "analytics-tools",
    officialDomain: "matomo.org",
    description: "Open-source web analytics, self-hosted or cloud.",
    status: "ACTIVE",
    aliases: ["piwik"],
    attributes: { hasFreePlan: true, platforms: "windows,mac,linux", hasFreeTrial: true },
    readinessNote: "Readiness=ready: free on-premise tier + platforms confirmed from the official site.",
  },
  {
    key: "plausible-analytics",
    canonicalName: "Plausible Analytics",
    categoryId: "analytics-tools",
    officialDomain: "plausible.io",
    description: "Open-source, privacy-friendly web analytics.",
    // Held back deliberately: DRAFT is never returned by production retrieval.
    status: "DRAFT",
    aliases: ["plausible"],
    attributes: { hasFreeTrial: true },
    readinessNote:
      "Readiness=needs-review: platforms only via low-confidence fallback and no defensible monthly price. Promote to ACTIVE once evidence confidence clears the threshold.",
  },
];

export function canonicalByKey(key: string): CanonicalEntitySeed | undefined {
  return CANONICAL_ENTITIES.find((e) => e.key === key);
}

/** Keys that production ranking may serve today. */
export function activeCanonicalKeys(): string[] {
  return CANONICAL_ENTITIES.filter((e) => e.status === "ACTIVE").map((e) => e.key);
}
