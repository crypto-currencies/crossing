/**
 * Source adapter seam.
 *
 * Two independent kinds of source, deliberately separated because the audit
 * found the current engine conflates them (docs/live-search-architecture.md §1.9):
 *
 *   DiscoverySource — answers "which products exist in this category?"
 *                     Produces CandidateLeads. Never asserts quality.
 *
 *   EvidenceSource  — answers "what do we know about THIS product?"
 *                     Produces Evidence. Declares whether it is INDEPENDENT of
 *                     the vendor, which is what makes it a reputation signal
 *                     rather than marketing copy.
 *
 * The `independence` field is the structural fix for §1.9: a source that is
 * `vendor` may assert facts (price, platforms) but may NEVER contribute a
 * rating or a quality signal. That rule is enforced in the gatherEvidence
 * stage, not left to each adapter's discipline.
 */

import type { Evidence } from "@/features/recommendation/evidence/types";
import type { CandidateLead, SearchContext, StageIssue } from "../contracts";

/**
 * Whether a source is independent of the thing it describes.
 *
 *   vendor      — the product's own site/docs. Factual claims only.
 *   independent — a third party with no commercial stake in this product.
 *   community   — user-generated discussion. Independent but noisy; weighted lower.
 */
export type SourceIndependence = "vendor" | "independent" | "community";

export interface SourceDescriptor {
  /** Stable id used in config, flags, metrics, and provenance. */
  id: string;
  /** Human label for admin/audit surfaces. */
  label: string;
  independence: SourceIndependence;
  /** True when the adapter performs network I/O (affects budgeting + caching). */
  network: boolean;
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export interface DiscoveryRequest {
  categoryId: string;
  /** The user's raw query, for sources that can use it as a search term. */
  rawQuery: string;
  /** How many leads this source should aim to return. */
  limit: number;
}

/**
 * Produces candidate leads for a category. A discovery source's job is BREADTH
 * — finding that a product exists. It must not rank, score, or judge quality;
 * `leadConfidence` expresses only "how sure am I this is a real, relevant
 * product in this category".
 */
export interface DiscoverySource {
  readonly descriptor: SourceDescriptor;
  /** Whether this source is currently usable (configured, flagged on, in budget). */
  isAvailable(ctx: SearchContext): boolean;
  discover(request: DiscoveryRequest, ctx: SearchContext): Promise<DiscoveryOutcome>;
}

export interface DiscoveryOutcome {
  leads: CandidateLead[];
  issues: StageIssue[];
  externalCalls: number;
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface EvidenceRequest {
  entityId: string;
  entityName: string;
  /** Registrable-domain key, when known — the strongest identity signal. */
  domainKey: string | null;
  categoryId: string;
}

/**
 * Produces evidence about a known entity. `independence` on the descriptor
 * determines what the pipeline will accept from it:
 *
 *   vendor      → attributes only; rating/reviewCount are stripped if present
 *   independent → attributes + rating + review topics
 *   community   → attributes + rating + review topics, down-weighted
 */
export interface EvidenceSource {
  readonly descriptor: SourceDescriptor;
  isAvailable(ctx: SearchContext): boolean;
  gather(request: EvidenceRequest, ctx: SearchContext): Promise<EvidenceOutcome>;
}

export interface EvidenceOutcome {
  evidence: Evidence[];
  issues: StageIssue[];
  externalCalls: number;
}

export interface BatchEvidenceOutcome {
  /** Evidence keyed by entityId. A missing key means "nothing found", not an error. */
  byEntity: Map<string, Evidence[]>;
  issues: StageIssue[];
  externalCalls: number;
}

/**
 * Optional capability: answer for many entities in one round trip. The
 * gatherEvidence stage prefers this when a source implements it, which is what
 * keeps a 20-candidate list from becoming 20 sequential lookups.
 */
export interface BatchEvidenceSource extends EvidenceSource {
  gatherMany(requests: EvidenceRequest[], ctx: SearchContext): Promise<BatchEvidenceOutcome>;
}

export function isBatchEvidenceSource(source: EvidenceSource): source is BatchEvidenceSource {
  return typeof (source as BatchEvidenceSource).gatherMany === "function";
}

// ─── Enforcement ─────────────────────────────────────────────────────────────

/**
 * Strip quality signals from a vendor source. This is the single chokepoint
 * that prevents §1.9 from recurring: no matter what a vendor adapter returns,
 * it cannot inject a rating into the ranking engine.
 */
export function enforceIndependence(
  evidence: Evidence[],
  independence: SourceIndependence
): { evidence: Evidence[]; stripped: number } {
  if (independence !== "vendor") return { evidence, stripped: 0 };

  let stripped = 0;
  const cleaned = evidence.map((e) => {
    if (e.rating == null && e.reviewCount === 0 && !e.reviewTopics?.length) return e;
    stripped += 1;
    return {
      ...e,
      rating: null,
      ratingScale: null,
      reviewCount: 0,
      reviewTopics: undefined,
    };
  });
  return { evidence: cleaned, stripped };
}

/** True when this evidence can contribute to a quality/reputation signal. */
export function isReputationBearing(independence: SourceIndependence): boolean {
  return independence === "independent" || independence === "community";
}
