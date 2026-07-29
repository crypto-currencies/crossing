/**
 * Entity resolution.
 *
 * Turns untrusted `DiscoveredCandidate` mentions into one of four explicit
 * outcomes. The central rule, stated in the brief and enforced here:
 *
 *   TWO ENTITIES ARE NEVER MERGED SOLELY BECAUSE THEIR NAMES ARE SIMILAR.
 *
 * Fuzzy name matching exists, but it can only ever produce
 * `probable-duplicate` — an outcome that routes to human review. It can never
 * produce `canonical`. Anything stronger requires a domain, an external id, or
 * an exact URL match.
 *
 * The six strategies, strongest first:
 *   1. verified canonical domain
 *   2. external provider id
 *   3. exact official URL
 *   4. name + location
 *   5. name + domain
 *   6. fuzzy name  → review only, never an automatic merge
 */

import type { Entity } from "@/features/recommendation/entities/types";
import { normalizeAlias } from "@/features/recommendation/entities/normalize";
import type { DiscoveredCandidate } from "../discovery/types";
import { normalizeDiscoveredUrl, registrableOf } from "../discovery/url";

// ─── Outcomes ────────────────────────────────────────────────────────────────

export type ResolutionStrategy =
  | "canonical-domain"
  | "external-id"
  | "exact-url"
  | "name-location"
  | "name-domain"
  | "fuzzy-name";

export type ResolutionOutcome =
  | {
      kind: "canonical";
      entity: Entity;
      strategy: ResolutionStrategy;
      confidence: number;
      candidate: DiscoveredCandidate;
    }
  | {
      /** A real-looking product we do not yet carry. Queued, never ranked. */
      kind: "new-unresolved";
      candidate: DiscoveredCandidate;
      /** Proposed alias/domain for a future curation step. */
      proposed: { name: string; domainKey: string | null };
    }
  | {
      /** Looks like something we carry, but not provably. Needs a human. */
      kind: "probable-duplicate";
      candidate: DiscoveredCandidate;
      possibleEntity: Entity;
      strategy: ResolutionStrategy;
      similarity: number;
      reason: string;
    }
  | {
      kind: "rejected";
      candidate: DiscoveredCandidate;
      reason: string;
    };

export interface ResolutionReport {
  outcomes: ResolutionOutcome[];
  /** Distinct canonical entities, deduped, with corroboration counts. */
  resolved: { entity: Entity; candidates: DiscoveredCandidate[]; distinctAdapters: number }[];
  counts: Record<ResolutionOutcome["kind"], number>;
}

/** Fuzzy similarity at or above this is worth a human look. Never an auto-merge. */
export const REVIEW_SIMILARITY_THRESHOLD = 0.86;

// ─── Index ───────────────────────────────────────────────────────────────────

interface EntityIndex {
  byDomainKey: Map<string, Entity>;
  byRegistrable: Map<string, Entity>;
  byExternalId: Map<string, Entity>;
  byName: Map<string, Entity>;
  all: Entity[];
}

export function buildIndex(entities: Entity[]): EntityIndex {
  const byDomainKey = new Map<string, Entity>();
  const byRegistrable = new Map<string, Entity>();
  const byExternalId = new Map<string, Entity>();
  const byName = new Map<string, Entity>();

  for (const e of entities) {
    byDomainKey.set(e.domainKey, e);
    const norm = normalizeDiscoveredUrl(e.officialDomain);
    if (norm) byRegistrable.set(registrableOf(norm.host), e);

    for (const x of e.externalIds) byExternalId.set(`${x.sourceType}:${x.externalId}`, e);

    byName.set(normalizeAlias(e.canonicalName), e);
    for (const alias of e.aliases) byName.set(normalizeAlias(alias), e);
  }

  return { byDomainKey, byRegistrable, byExternalId, byName, all: entities };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** The category being searched — a cross-category match is rejected. */
  categoryId: string;
  /** Location text from the query, for the name+location strategy. */
  queryLocation?: string | null;
}

export function resolveCandidates(
  candidates: DiscoveredCandidate[],
  entities: Entity[],
  options: ResolveOptions
): ResolutionReport {
  const index = buildIndex(entities);
  const outcomes = candidates.map((c) => resolveOne(c, index, options));

  // Group the canonical hits into distinct entities with corroboration counts.
  const grouped = new Map<string, { entity: Entity; candidates: DiscoveredCandidate[]; adapters: Set<string> }>();
  for (const o of outcomes) {
    if (o.kind !== "canonical") continue;
    const existing = grouped.get(o.entity.id);
    if (existing) {
      existing.candidates.push(o.candidate);
      existing.adapters.add(o.candidate.sourceAdapter);
    } else {
      grouped.set(o.entity.id, {
        entity: o.entity,
        candidates: [o.candidate],
        adapters: new Set([o.candidate.sourceAdapter]),
      });
    }
  }

  const counts: Record<ResolutionOutcome["kind"], number> = {
    canonical: 0,
    "new-unresolved": 0,
    "probable-duplicate": 0,
    rejected: 0,
  };
  for (const o of outcomes) counts[o.kind] += 1;

  return {
    outcomes,
    resolved: [...grouped.values()]
      .map((g) => ({
        entity: g.entity,
        candidates: g.candidates,
        distinctAdapters: g.adapters.size,
      }))
      // Deterministic order before ranking.
      .sort((a, b) => a.entity.id.localeCompare(b.entity.id)),
    counts,
  };
}

function resolveOne(
  candidate: DiscoveredCandidate,
  index: EntityIndex,
  options: ResolveOptions
): ResolutionOutcome {
  const name = normalizeAlias(candidate.name);
  if (!name) {
    return { kind: "rejected", candidate, reason: "Candidate has no usable name." };
  }

  const norm = candidate.candidateUrl ? normalizeDiscoveredUrl(candidate.candidateUrl) : null;
  if (candidate.candidateUrl && !norm) {
    return { kind: "rejected", candidate, reason: "Candidate URL is unparseable." };
  }
  if (norm?.isJunk) {
    return { kind: "rejected", candidate, reason: "Candidate URL is a search-engine artifact." };
  }

  const inCategory = (e: Entity): boolean => e.categoryId === options.categoryId;
  const wrongCategory = (e: Entity): ResolutionOutcome => ({
    kind: "rejected",
    candidate,
    reason: `Matched "${e.canonicalName}", which is in ${e.categoryId}, not ${options.categoryId}.`,
  });

  // ── 1. Verified canonical domain ────────────────────────────────────────
  if (norm) {
    const byKey = index.byDomainKey.get(norm.domainKey);
    if (byKey) {
      return inCategory(byKey)
        ? { kind: "canonical", entity: byKey, strategy: "canonical-domain", confidence: 1, candidate }
        : wrongCategory(byKey);
    }
  }

  // ── 2. External provider id ─────────────────────────────────────────────
  for (const x of candidate.externalIds) {
    const hit = index.byExternalId.get(`${x.system}:${x.id}`);
    if (hit) {
      return inCategory(hit)
        ? { kind: "canonical", entity: hit, strategy: "external-id", confidence: 0.98, candidate }
        : wrongCategory(hit);
    }
  }

  // ── 3. Exact official URL (registrable-domain equality) ─────────────────
  if (norm) {
    const hit = index.byRegistrable.get(registrableOf(norm.host));
    if (hit) {
      return inCategory(hit)
        ? { kind: "canonical", entity: hit, strategy: "exact-url", confidence: 0.95, candidate }
        : wrongCategory(hit);
    }
  }

  const nameHit = index.byName.get(name);

  // ── 4. Name + location ──────────────────────────────────────────────────
  // Both sides must actually assert a location; otherwise this is just a name
  // match wearing a disguise, and it falls through to the weaker rungs.
  if (nameHit && candidate.location && options.queryLocation) {
    const entityLocation = String(nameHit.attributes.location ?? "");
    if (entityLocation && locationsAgree(entityLocation, candidate.location)) {
      return inCategory(nameHit)
        ? { kind: "canonical", entity: nameHit, strategy: "name-location", confidence: 0.9, candidate }
        : wrongCategory(nameHit);
    }
  }

  // ── 5. Name + domain ────────────────────────────────────────────────────
  // An exact name match AND a domain that contains the name is two independent
  // signals agreeing, which is enough to be canonical.
  if (nameHit && norm) {
    const label = registrableOf(norm.host).split(".")[0];
    const compact = name.replace(/[^a-z0-9]/g, "");
    if (label && compact && (label.includes(compact) || compact.includes(label))) {
      return inCategory(nameHit)
        ? { kind: "canonical", entity: nameHit, strategy: "name-domain", confidence: 0.88, candidate }
        : wrongCategory(nameHit);
    }
  }

  // ── 6. Fuzzy name → REVIEW ONLY ─────────────────────────────────────────
  // Deliberately cannot return `canonical`. A name that merely looks alike is
  // how "Notion" and "Notational" become the same product — so a human decides.
  const best = bestFuzzy(name, index);
  if (best && best.similarity >= REVIEW_SIMILARITY_THRESHOLD) {
    return {
      kind: "probable-duplicate",
      candidate,
      possibleEntity: best.entity,
      strategy: "fuzzy-name",
      similarity: best.similarity,
      reason: `Name resembles "${best.entity.canonicalName}" but no domain, external id, or URL confirms it.`,
    };
  }

  // Nothing matched: a real-looking product we simply do not carry yet.
  return {
    kind: "new-unresolved",
    candidate,
    proposed: { name: candidate.name, domainKey: norm?.domainKey ?? null },
  };
}

// ─── Similarity ──────────────────────────────────────────────────────────────

function bestFuzzy(name: string, index: EntityIndex): { entity: Entity; similarity: number } | null {
  let best: { entity: Entity; similarity: number } | null = null;
  for (const [key, entity] of index.byName) {
    const similarity = diceCoefficient(name, key);
    if (!best || similarity > best.similarity) best = { entity, similarity };
  }
  return best;
}

/** Sørensen–Dice over character bigrams. Deterministic, no dependencies. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const aB = bigrams(a);
  const bB = bigrams(b);
  let intersection = 0;
  for (const [g, count] of aB) {
    const other = bB.get(g);
    if (other) intersection += Math.min(count, other);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/** Loose location agreement — token overlap, not geocoding. */
function locationsAgree(a: string, b: string): boolean {
  const tokens = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2)
    );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

// ─── Alias / external-id capture ─────────────────────────────────────────────

export interface AliasCapture {
  entityId: string;
  aliases: string[];
  externalIds: { system: string; id: string }[];
}

/**
 * Aliases and external ids worth persisting after a successful resolution.
 *
 * Returned rather than written: this module resolves, it does not mutate the
 * catalog. Nothing discovered on the web edits a canonical entity automatically.
 */
export function captureAliases(report: ResolutionReport): AliasCapture[] {
  const out: AliasCapture[] = [];
  for (const group of report.resolved) {
    const known = new Set([
      normalizeAlias(group.entity.canonicalName),
      ...group.entity.aliases.map(normalizeAlias),
    ]);
    const aliases = [
      ...new Set(
        group.candidates
          .map((c) => c.name.trim())
          .filter((n) => n && !known.has(normalizeAlias(n)))
      ),
    ];
    const seen = new Set(group.entity.externalIds.map((x) => `${x.sourceType}:${x.externalId}`));
    const externalIds = group.candidates
      .flatMap((c) => c.externalIds)
      .filter((x) => !seen.has(`${x.system}:${x.id}`));

    if (aliases.length || externalIds.length) {
      out.push({ entityId: group.entity.id, aliases, externalIds });
    }
  }
  return out;
}
