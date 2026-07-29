/**
 * Canonical entity + external-identity models.
 *
 * An entity is the recommendation unit (a single tool/service). Its canonical
 * key is its normalized official domain — the same normalization the discovery
 * domain already uses for one-listing-per-site (lib/server/url-normalize.ts) —
 * so entities and the community `Listing` catalog can converge later without
 * fuzzy name matching. Phase 1 does NOT auto-merge entities; resolution is
 * exact-key only (see entities/normalize.ts).
 */

import type { Evidence } from "../evidence/types";

/** A pointer to this entity's identity on an external source. */
export interface ExternalSourceId {
  sourceType: string;
  externalId: string;
  url: string;
}

export interface Entity {
  id: string;
  /** Display name, e.g. "Vercel". */
  canonicalName: string;
  /** Official website, as authored. */
  officialDomain: string;
  /** Normalized comparison key derived from officialDomain (never displayed). */
  domainKey: string;
  categoryId: string;
  /** Lowercased alternate names — "postgres" for "PostgreSQL", etc. */
  aliases: string[];
  description: string;
  /** Structured, engine-usable facts. Keys match category attribute keys. */
  attributes: Record<string, string | number | boolean>;
  externalIds: ExternalSourceId[];
  /** Evidence gathered for this entity (from fixtures in Phase 1). */
  evidence: Evidence[];
  /** ISO timestamp of the entity's own last update (distinct from evidence freshness). */
  lastUpdatedAt: string;
}
