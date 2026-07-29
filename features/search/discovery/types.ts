/**
 * Candidate discovery — adapter interface and the discovered-candidate shape.
 *
 * A `DiscoveredCandidate` is an UNTRUSTED MENTION of a product. It is not an
 * entity, it is not canonical, and it carries no quality claim. Promotion from
 * "some page mentioned this" to "a canonical entity Crossing ranks" is a
 * separate, deliberate step (see ../resolution/) that a discovery adapter can
 * never perform on its own.
 *
 * That separation is the core safety property of this layer: an arbitrary page
 * on the web can influence what we CONSIDER, never what we ASSERT.
 */

import type { SearchContext, StageIssue } from "../contracts";

/**
 * Discovery layers, in the order the brief specifies. Lower `tier` runs first
 * and is trusted more; a later tier only runs when earlier tiers leave the pool
 * short, which keeps the expensive/loose layers off the common path.
 */
export const DISCOVERY_LAYERS = [
  "canonical", // 1. entities we already curate
  "web-search", // 2. structured search-provider results
  "category", // 3. category-specific providers
  "directory", // 4. curated directories, where permitted
  "official-site", // 5. official-site discovery
  "agentic", // 6. bounded agentic fallback
] as const;

export type DiscoveryLayer = (typeof DISCOVERY_LAYERS)[number];

/** Trust tier by layer — used to order adapters and to seed lead confidence. */
export const LAYER_TIER: Record<DiscoveryLayer, number> = {
  canonical: 1,
  "web-search": 2,
  category: 3,
  directory: 4,
  "official-site": 5,
  agentic: 6,
};

/**
 * One raw candidate mention. Every field is either observed or null — nothing
 * here is inferred to make the record look complete.
 */
export interface DiscoveredCandidate {
  /** Product name as the source wrote it. Not yet canonical. */
  name: string;
  /** The product's own URL, when the source supplied one. */
  candidateUrl: string | null;
  /** The page this mention was found on — provenance for the mention itself. */
  sourceUrl: string;
  /** Which adapter produced this candidate. */
  sourceAdapter: string;
  /** Which layer that adapter belongs to. */
  layer: DiscoveryLayer;
  /** Text the source showed alongside the mention. Never treated as a review. */
  snippet: string | null;
  /** Categories this mention suggests. Hints only — the gate still decides. */
  categoryHints: string[];
  /** Free-text location, for categories where place matters. Null otherwise. */
  location: string | null;
  /** Provider/registry identifiers, when the source exposes one. */
  externalIds: { system: string; id: string }[];
  /**
   * 0..1 — how confident we are this is a REAL, RELEVANT product in this
   * category. An identity signal, never a quality signal.
   */
  discoveryConfidence: number;
  /** ISO timestamp the mention was observed. */
  discoveredAt: string;
}

// ─── Adapter interface ───────────────────────────────────────────────────────

export interface DiscoveryContext extends SearchContext {
  categoryId: string;
  categoryName: string;
  rawQuery: string;
  /** How many raw candidates the pipeline still wants. */
  wanted: number;
}

export interface DiscoveryAdapterOutcome {
  candidates: DiscoveredCandidate[];
  issues: StageIssue[];
  /** External calls made — feeds observability and cost tracking. */
  externalCalls: number;
  /** Estimated USD spent by this adapter. */
  costUsd: number;
  /** Search strings actually issued, for the diagnostics trace. */
  queriesIssued: string[];
}

export interface CandidateDiscoveryAdapter {
  readonly id: string;
  readonly layer: DiscoveryLayer;
  /** Whether this adapter can run for this context (configured, in budget). */
  supports(context: DiscoveryContext): boolean;
  discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome>;
}

// ─── Targets ─────────────────────────────────────────────────────────────────

/**
 * Raw candidate pool targets, before dedup/filtering/ranking. The brief asks for
 * 20–50 raw candidates; layers keep running until MIN is met or all are spent.
 */
export const RAW_CANDIDATE_MIN = 20;
export const RAW_CANDIDATE_MAX = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function emptyOutcome(): DiscoveryAdapterOutcome {
  return { candidates: [], issues: [], externalCalls: 0, costUsd: 0, queriesIssued: [] };
}

/** Build a candidate with the non-negotiable fields filled and the rest null. */
export function candidate(
  fields: Pick<DiscoveredCandidate, "name" | "sourceUrl" | "sourceAdapter" | "layer" | "discoveryConfidence" | "discoveredAt"> &
    Partial<DiscoveredCandidate>
): DiscoveredCandidate {
  return {
    candidateUrl: null,
    snippet: null,
    categoryHints: [],
    location: null,
    externalIds: [],
    ...fields,
  };
}
