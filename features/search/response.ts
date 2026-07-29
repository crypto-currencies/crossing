/**
 * The public ranked-list response contract (Parts 7 + 8).
 *
 * Two hard rules distinguish this from the old `{ bestMatch, alternatives }`
 * shape:
 *
 *   1. Public fields carry USER language only. Scores, parser confidence, and
 *      pipeline vocabulary live in `diagnostics`, which is development/admin
 *      only. `copy.ts` owns every public string.
 *   2. Results are never padded. If only four options have real evidence, four
 *      come back with a warning — not ten with six weak entries to hit a target.
 */

import type { ParsedQuery } from "@/features/recommendation/query/schema";
import type { ScoreBreakdown } from "@/features/recommendation/ranking/score";
import type { EvidenceStrength, FreshnessSummary } from "./copy";
import type { SearchDiagnostics } from "./diagnostics";

// ─── Result parts ────────────────────────────────────────────────────────────

/** One displayed fact. `verified` is what lets the UI mark unverified claims. */
export interface RankedAttribute {
  label: string;
  value: string;
  /** True when an independent or official source explicitly asserted it. */
  verified: boolean;
  /** Provenance for this specific fact. */
  sourceUrl?: string;
}

/**
 * Provider attribution the frontend MUST render. Travels with the data so a
 * presentation change cannot silently drop a required element and put us in
 * breach of a provider's terms.
 */
export interface ReviewAttribution {
  provider: string;
  providerName: string;
  /** Bundled-asset key — never a hotlinked provider URL. */
  providerLogoKey: string | null;
  sourceUrl: string;
  /** Rating on the PROVIDER's own scale, for display next to their brand. */
  rating: number | null;
  ratingScale: number | null;
  reviewCount: number;
  retrievedAt: string;
  /** Verbatim text the provider mandates. */
  requiredText: string | null;
  requiresBacklink: boolean;
  requiresNewTab: boolean;
}

/** Independent reputation ONLY. Official-site claims can never populate this. */
export interface ReviewSummary {
  /** 0..5 display rating derived from independent sources, or null. */
  rating: number | null;
  reviewCount: number;
  /** Plain-language recency, e.g. "Reviews from the last 3 months". */
  recency: string | null;
  praise: string[];
  complaints: string[];
  /** How many distinct independent sources agreed. */
  sourceCount: number;
  /** True when sources materially disagree — surfaced, never averaged away. */
  sourcesDisagree: boolean;
  /** Per-provider attribution. Empty when no independent source contributed. */
  attributions: ReviewAttribution[];
}

export interface PriceSummary {
  /** Display string, e.g. "From $15/mo" or "Free plan available". */
  display: string;
  monthlyFrom: number | null;
  hasFreePlan: boolean | null;
  hasFreeTrial: boolean | null;
  /** False when pricing could not be established — never guessed. */
  verified: boolean;
}

/** What one source contributed, for the "where this came from" surface. */
export interface SourceSummary {
  label: string;
  url: string;
  /** Which evidence class this source belongs to. */
  kind: "official" | "independent" | "editorial";
  retrievedAt: string;
}

export interface RankedResult {
  rank: number;
  entityId: string;
  name: string;
  url?: string;
  category: string;
  /** Plain-language "why this is here". */
  shortReason: string;
  bestFor?: string;
  keyAttributes: RankedAttribute[];
  reviewSummary?: ReviewSummary;
  priceSummary?: PriceSummary;
  tradeoffs: string[];
  sourceSummaries: SourceSummary[];
  /** Describes the EVIDENCE, never the model. */
  evidenceStrength: EvidenceStrength;
  freshness: FreshnessSummary;
  /** Development/admin only — omitted from production responses. */
  scoreBreakdown?: ScoreBreakdown;
}

// ─── Coverage ────────────────────────────────────────────────────────────────

/** Public-facing statement of how well-evidenced the whole result set is. */
export interface EvidenceCoverage {
  /** Options with any independent (non-vendor) evidence. */
  withIndependentReviews: number;
  /** Options with an independent aggregate rating. */
  withRatings: number;
  /** Options whose pricing was verified. */
  withVerifiedPricing: number;
  /** Distinct source types across the whole result set. */
  distinctSources: number;
  /** Plain-language statements of what is missing. Never fabricated. */
  gaps: string[];
}

export type SearchWarning = string;

export interface CategoryOption {
  id: string;
  label: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 20;

/**
 * An opaque cursor. It pins the EVIDENCE SNAPSHOT as well as the offset, so
 * paging through a list that was computed against one snapshot cannot silently
 * interleave results from a newer one — that is what "stable ordering for the
 * same evidence snapshot" requires.
 */
export interface PageCursor {
  offset: number;
  /** Fingerprint of the ranked entity set this page was cut from. */
  snapshot: string;
}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): PageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as PageCursor).offset === "number" &&
      typeof (parsed as PageCursor).snapshot === "string" &&
      (parsed as PageCursor).offset >= 0
    ) {
      return parsed as PageCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fingerprint the ordered entity set. Two requests that ranked the same
 * entities in the same order share a snapshot id; any change invalidates
 * outstanding cursors rather than serving a page from a stale ordering.
 */
export function snapshotId(entityIds: string[]): string {
  let hash = 2166136261;
  for (const id of entityIds) {
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0x2c;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// ─── Response ────────────────────────────────────────────────────────────────

export interface ResponseMeta {
  requestId: string;
  timingMs: number;
  /** Development/admin only. Never present in a production response. */
  diagnostics?: SearchDiagnostics;
}

export type RankedSearchResponse =
  | (ResponseMeta & {
      status: "success";
      /** Retained for clients that echo the interpretation; not user-facing copy. */
      query: ParsedQuery;
      title: string;
      summary?: string;
      results: RankedResult[];
      totalDiscovered: number;
      totalEvaluated: number;
      evidenceCoverage: EvidenceCoverage;
      warnings: SearchWarning[];
      nextCursor?: string;
    })
  | (ResponseMeta & {
      status: "needs-clarification";
      query: ParsedQuery;
      title: string;
      options: CategoryOption[];
      message: string;
    })
  | (ResponseMeta & {
      status: "unsupported";
      query: ParsedQuery;
      title: string;
      message: string;
    })
  | (ResponseMeta & {
      status: "no-results";
      query: ParsedQuery;
      title: string;
      message: string;
      /** What was considered and rejected, so the user can adjust. */
      excluded: { name: string; reasons: string[] }[];
      totalDiscovered: number;
      totalEvaluated: number;
      warnings: SearchWarning[];
    })
  | (ResponseMeta & {
      status: "error";
      code: "internal_error" | "search_unavailable" | "deadline_exceeded";
      message: string;
    });

/** HTTP status for each response state. */
export function httpStatusFor(response: RankedSearchResponse): number {
  if (response.status !== "error") return 200;
  return response.code === "search_unavailable" ? 503 : 500;
}

// ─── Paging helper ───────────────────────────────────────────────────────────

export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

/**
 * Cut a page from a stable ordering.
 *
 * A cursor whose snapshot does not match the current ordering is REJECTED
 * (paging restarts at offset 0) rather than applied to different data —
 * silently reusing it is how duplicate and skipped entities appear across pages.
 */
export function paginate<T>(
  ordered: T[],
  idsOf: (items: T[]) => string[],
  options: { limit?: number; cursor?: string | null }
): PageResult<T> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const snapshot = snapshotId(idsOf(ordered));

  let offset = 0;
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded && decoded.snapshot === snapshot) offset = decoded.offset;
  }

  const items = ordered.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < ordered.length;

  return {
    items,
    ...(hasMore ? { nextCursor: encodeCursor({ offset: nextOffset, snapshot }) } : {}),
  };
}
