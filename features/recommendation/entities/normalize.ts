/**
 * Domain + alias normalization and exact-key entity resolution.
 *
 * Deliberately conservative: NO fuzzy automatic merges (Phase 1). Two entities
 * merge only if their normalized domain keys are identical. Name/alias
 * normalization exists to make lookups predictable, not to guess equivalence.
 */

import { normalizeUrlKey } from "@/lib/server/url-normalize";
import type { Entity } from "./types";

/**
 * Normalize an official domain to a comparison key, reusing the discovery
 * domain's URL normalization. Accepts bare hosts ("vercel.com") as well as
 * full URLs by prefixing a scheme when none is present.
 * @throws Error("invalid_url") on unparseable input.
 */
export function normalizeDomainKey(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return normalizeUrlKey(withScheme);
}

/** Lowercase, collapse whitespace, strip punctuation noise for stable alias matching. */
export function normalizeAlias(alias: string): string {
  return alias
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9+#. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All lookup keys for an entity: normalized canonical name + normalized aliases. */
export function entityLookupTokens(entity: Entity): string[] {
  return [normalizeAlias(entity.canonicalName), ...entity.aliases.map(normalizeAlias)].filter(Boolean);
}

/**
 * Resolve/deduplicate a list of entities by exact domain key. When two entities
 * share a key, the first wins and the second's evidence + aliases are merged in
 * (union), but no name-based guessing ever merges distinct keys.
 */
export function resolveEntities(entities: Entity[]): Entity[] {
  const byKey = new Map<string, Entity>();

  for (const entity of entities) {
    const existing = byKey.get(entity.domainKey);
    if (!existing) {
      byKey.set(entity.domainKey, entity);
      continue;
    }
    // Merge conservatively: union aliases + evidence, keep the first entity's identity.
    existing.aliases = Array.from(new Set([...existing.aliases, ...entity.aliases]));
    existing.evidence = [...existing.evidence, ...entity.evidence];
    existing.externalIds = [...existing.externalIds, ...entity.externalIds];
  }

  return Array.from(byKey.values());
}
