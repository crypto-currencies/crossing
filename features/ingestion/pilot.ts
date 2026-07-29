/**
 * Real-vendor pilot entities (analytics category).
 *
 * These are REAL products with correct identities — deliberately NOT the
 * fictional seed fixtures. We do not pretend a fictional placeholder and a real
 * vendor are the same company: the pilot introduces new, correctly-named
 * canonical entities and disables the fictional analytics seeds for ingestion.
 *
 * The pilot entities carry ONLY truthful identity (name, domain, category) and a
 * neutral factual description. They assert NO ratings, prices, or feature facts —
 * those come exclusively from official-site ingestion. Nothing here is fabricated.
 *
 * They are intentionally NOT part of the default ranking corpus (buildFixtures),
 * so validated seeded ranking is unchanged. They enter ranking only when their
 * category/entity is explicitly merge-enabled AND ready (features/ingestion/config.ts,
 * merge.ts) — which is off in this phase.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import { normalizeDomainKey } from "@/features/recommendation/entities/normalize";

export interface PilotMapping {
  entityId: string;
  canonicalName: string;
  canonicalDomain: string;
  /** The fictional seed this pilot conceptually stands in for (never merged with it). */
  seedPlaceholder: string;
  rationale: string;
}

function pilotEntity(id: string, name: string, domain: string, description: string): Entity {
  return {
    id,
    canonicalName: name,
    officialDomain: domain,
    domainKey: normalizeDomainKey(domain),
    categoryId: "analytics-tools",
    aliases: [],
    description,
    // No fabricated facts — official ingestion fills these.
    attributes: {},
    externalIds: [],
    evidence: [],
    lastUpdatedAt: "1970-01-01T00:00:00.000Z",
  };
}

export const PILOT_ENTITIES: Entity[] = [
  pilotEntity("plausible-analytics", "Plausible Analytics", "plausible.io", "Open-source, privacy-friendly web analytics."),
  pilotEntity("fathom-analytics", "Fathom Analytics", "usefathom.com", "Privacy-focused website analytics."),
  pilotEntity("matomo", "Matomo", "matomo.org", "Open-source web analytics platform (self-hosted or cloud)."),
];

const BY_ID = new Map(PILOT_ENTITIES.map((e) => [e.id, e]));

export function getPilotSeedEntity(entityId: string): Entity | undefined {
  return BY_ID.get(entityId);
}

export function isPilotEntity(entityId: string): boolean {
  return BY_ID.has(entityId);
}

/**
 * Documented mapping. The fictional analytics seeds (tally-metrics,
 * northwind-analytics) remain demo-only ranking data and are DISABLED for
 * ingestion — they are never presented as, or merged with, a real vendor.
 */
export const PILOT_MAPPING: PilotMapping[] = [
  {
    entityId: "plausible-analytics",
    canonicalName: "Plausible Analytics",
    canonicalDomain: "plausible.io",
    seedPlaceholder: "tally-metrics (fictional privacy/open-source analytics)",
    rationale: "Real privacy-first, open-source, self-hostable analytics with a public site — the same profile the fictional seed stood in for.",
  },
  {
    entityId: "fathom-analytics",
    canonicalName: "Fathom Analytics",
    canonicalDomain: "usefathom.com",
    seedPlaceholder: "(new real entity — analytics category)",
    rationale: "Real privacy analytics with a clear public pricing page — good structured-pricing test case.",
  },
  {
    entityId: "matomo",
    canonicalName: "Matomo",
    canonicalDomain: "matomo.org",
    seedPlaceholder: "northwind-analytics (fictional established analytics incumbent)",
    rationale: "Long-established, widely-used open-source analytics with a public cloud pricing page.",
  },
];
