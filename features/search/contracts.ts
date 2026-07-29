/**
 * Live-search orchestrator — stage contracts.
 *
 * The pipeline is a sequence of NAMED, INDEPENDENTLY TESTABLE stages, not one
 * opaque autonomous call. Every stage:
 *
 *   - declares its input and output types,
 *   - returns non-fatal problems as `issues` instead of throwing,
 *   - reports `metrics` so a whole run can be traced,
 *   - and is pure with respect to its inputs plus an injected `SearchContext`.
 *
 * Bounded model use is permitted INSIDE `parse` and `normalize` only, and only
 * behind schema validation with a deterministic fallback. Filtering and ranking
 * are always code-driven — a model never selects or orders results.
 *
 * See docs/live-search-architecture.md §2 for the design rationale.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import type { ParsedQuery } from "@/features/recommendation/query/schema";
import type { CategoryResolution } from "@/features/recommendation/categories/resolve";
import type { ScoreBreakdown } from "@/features/recommendation/ranking/score";
import type { EvidenceRef } from "@/features/recommendation/types";

// ─── Stage identity ──────────────────────────────────────────────────────────

/** The nine pipeline stages, in execution order. */
export const STAGE_NAMES = [
  "parse",
  "resolve",
  "discover",
  "normalize",
  "resolveEntities",
  "gatherEvidence",
  "filter",
  "rank",
  "respond",
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

// ─── Stage result envelope ───────────────────────────────────────────────────

/**
 * A non-fatal problem. A stage records an issue and carries on with whatever it
 * did manage to produce — a source timing out must degrade the result, not
 * fail the request.
 */
export interface StageIssue {
  stage: StageName;
  /** Machine-readable kind, for metrics and tests. */
  code:
    | "source_unavailable"
    | "source_timeout"
    | "source_rejected"
    | "partial_data"
    | "field_absent"
    | "low_confidence"
    | "budget_exhausted"
    | "validation_failed"
    | "fallback_used";
  /** Human-readable detail. Never contains secrets or raw provider output. */
  detail: string;
  /** The entity/source the issue concerns, when it is scoped to one. */
  subject?: string;
}

export interface StageMetrics {
  stage: StageName;
  /** Wall-clock milliseconds for this stage. */
  durationMs: number;
  /** Items received. */
  itemsIn: number;
  /** Items produced. */
  itemsOut: number;
  /** External network calls this stage made (0 for pure stages). */
  externalCalls: number;
  /** True when the stage served from cache rather than doing its work. */
  cacheHit?: boolean;
}

export interface StageResult<T> {
  output: T;
  issues: StageIssue[];
  metrics: StageMetrics;
}

/**
 * Every stage implements this. Uniformity is what makes the pipeline
 * inspectable: the runner can time, trace, and short-circuit any stage without
 * knowing what it does.
 */
export interface Stage<In, Out> {
  readonly name: StageName;
  run(input: In, ctx: SearchContext): Promise<StageResult<Out>>;
}

// ─── Execution context ───────────────────────────────────────────────────────

/**
 * Injected into every stage. Holds the things a stage must not reach for
 * globally: the clock, the environment, cancellation, and the remaining budget.
 */
export interface SearchContext {
  requestId: string;
  /** Injectable clock — every stage uses this, never `new Date()` directly. */
  now: Date;
  env: NodeJS.ProcessEnv;
  /** Cancellation, so one slow external source cannot hang the request. */
  signal?: AbortSignal;
  /** Wall-clock milliseconds the whole pipeline may consume. */
  deadlineMs: number;
  /** True in development — enables the full trace in the response. */
  isDev: boolean;
}

// ─── Per-stage input/output types ────────────────────────────────────────────

/** `discover` output: a raw, un-deduped, un-verified candidate mention. */
export interface CandidateLead {
  /** Name as the source wrote it — not yet canonical. */
  rawName: string;
  /** Official URL if the source supplied one. */
  url?: string;
  /** Which discovery source produced this lead. */
  sourceId: string;
  /** Where the lead was found, for provenance. */
  sourceUrl: string;
  /** 0..1 — how much this source's mention alone is worth. Never a quality score. */
  leadConfidence: number;
}

/** `normalize` output: a lead cleaned into a comparable shape. */
export interface NormalizedCandidate extends CandidateLead {
  /** Lowercased, punctuation-stripped name for matching. */
  normalizedName: string;
  /** Registrable-domain key derived from `url`, or null when no URL was found. */
  domainKey: string | null;
}

/** `resolveEntities` output: one canonical entity plus the leads that produced it. */
export interface ResolvedCandidate {
  entity: Entity;
  /** Every lead that merged into this entity — the dedup audit trail. */
  leads: NormalizedCandidate[];
  /** How many distinct discovery sources independently mentioned this entity. */
  distinctSources: number;
}

/**
 * What evidence a candidate actually has. Absence is first-class: a missing
 * rating is reported as missing, never defaulted to a number.
 */
export interface EvidenceCoverage {
  /** Official-site factual evidence was retrieved. */
  hasFactual: boolean;
  /** At least one INDEPENDENT (non-vendor) source was retrieved. */
  hasIndependent: boolean;
  /** A real, source-attributed rating exists. */
  hasRating: boolean;
  /** Distinct source types backing this candidate. */
  sourceTypes: string[];
  /** Attributes we tried to resolve and could not. Drives honest UI copy. */
  missingAttributes: string[];
  /** Age in days of the freshest evidence, or null when nothing is dated. */
  freshestAgeDays: number | null;
}

export interface EvidencedCandidate extends ResolvedCandidate {
  coverage: EvidenceCoverage;
}

/** `filter` output: eligibility decided, nothing dropped silently. */
export interface FilteredCandidate extends EvidencedCandidate {
  eligible: boolean;
  /** Why it failed, when it did. Empty when eligible. */
  ineligibleReasons: string[];
}

// ─── Ranked output ───────────────────────────────────────────────────────────

/**
 * One entry in the ranked list. Note there is no "best" flag — position in the
 * list is the only ranking statement, and the list is 10–20 long.
 */
export interface RankedResult {
  /** 1-based position in the ranked list. */
  rank: number;
  entityId: string;
  name: string;
  domain: string;
  categoryId: string;
  description: string;
  /** 0..1 deterministic score. */
  score: number;
  breakdown: ScoreBreakdown;
  matchedConstraints: string[];
  unmetPreferences: string[];
  tradeoffs: string[];
  evidenceRefs: EvidenceRef[];
  coverage: EvidenceCoverage;
}

/** Why a candidate was excluded — shown, not hidden. */
export interface ExcludedResult {
  entityId: string;
  name: string;
  reasons: string[];
}

/**
 * Whole-result-set honesty. `sparse` responses carry this so the UI can say
 * exactly what is thin rather than implying the list is the whole market.
 */
export interface CoverageReport {
  /** Candidates discovered before dedup. */
  discovered: number;
  /** Canonical entities after dedup. */
  resolved: number;
  /** Entities that passed hard constraints. */
  eligible: number;
  /** How many carry any independent (non-vendor) evidence. */
  withIndependentEvidence: number;
  /** How many carry a real rating. */
  withRating: number;
  /** Target list size we were aiming for. */
  targetCount: number;
  /** Plain-language statements of what is missing. Never fabricated. */
  gaps: string[];
}

// ─── Response contract ───────────────────────────────────────────────────────

/** Fields on every response variant. */
export interface RankedResponseMeta {
  requestId: string;
  timingMs: number;
  /** Full per-stage trace. Development only — never sent in production. */
  trace?: StageTrace;
}

export interface StageTrace {
  metrics: StageMetrics[];
  issues: StageIssue[];
  /** Where candidates came from, per discovery source. */
  candidateSources: Record<string, number>;
}

export interface CategorySuggestion {
  id: string;
  label: string;
}

/**
 * The ranked-list contract. Replaces the one-winner
 * `{ bestMatch, alternatives }` shape — see docs/live-search-architecture.md §1.6.
 */
export type RankedSearchResponse =
  | (RankedResponseMeta & {
      status: "ranked";
      parsedQuery: ParsedQuery;
      categoryId: string;
      categoryName: string;
      results: RankedResult[];
      excluded: ExcludedResult[];
      coverage: CoverageReport;
      warnings: string[];
    })
  | (RankedResponseMeta & {
      /** Real candidates, but materially fewer or thinner than a good answer needs. */
      status: "sparse";
      parsedQuery: ParsedQuery;
      categoryId: string;
      categoryName: string;
      results: RankedResult[];
      excluded: ExcludedResult[];
      coverage: CoverageReport;
      warnings: string[];
      message: string;
    })
  | (RankedResponseMeta & {
      status: "no-results";
      parsedQuery: ParsedQuery;
      categoryId: string;
      categoryName: string;
      excluded: ExcludedResult[];
      coverage: CoverageReport;
      message: string;
    })
  | (RankedResponseMeta & {
      status: "unsupported-category";
      parsedQuery: ParsedQuery;
      category: CategoryResolution;
      message: string;
    })
  | (RankedResponseMeta & {
      status: "needs-clarification";
      parsedQuery: ParsedQuery;
      category: CategoryResolution;
      suggestions: CategorySuggestion[];
      message: string;
    })
  | (RankedResponseMeta & {
      status: "error";
      code: "internal_error" | "deadline_exceeded" | "no_discovery_source";
      message: string;
    });

// ─── Orchestrator ────────────────────────────────────────────────────────────

export interface SearchRequestInput {
  query: string;
  /** Desired list size. Defaults to TARGET_RESULT_COUNT. */
  resultCount?: number;
  /** User-pinned category, bypassing text resolution. */
  categoryId?: string;
}

export interface SearchOrchestrator {
  search(input: SearchRequestInput): Promise<RankedSearchResponse>;
}

// ─── Tunables ────────────────────────────────────────────────────────────────

/**
 * The product target: a ranked list of ~10–20 strong candidates, not one winner
 * and two alternatives (docs/live-search-architecture.md §1.3).
 */
export const TARGET_RESULT_COUNT = 12;
export const MIN_RESULT_COUNT = 10;
export const MAX_RANKED_RESULTS = 20;

/**
 * Below this many eligible results, the response is `sparse` rather than
 * `ranked` — we say the pool is thin instead of implying it is the market.
 */
export const SPARSE_THRESHOLD = 5;

/** Default whole-pipeline budget. Discovery and evidence stages do network I/O. */
export const DEFAULT_DEADLINE_MS = 8_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a StageResult for a stage that did no external work. */
export function pureResult<T>(
  stage: StageName,
  output: T,
  startedAt: number,
  counts: { in: number; out: number },
  issues: StageIssue[] = []
): StageResult<T> {
  return {
    output,
    issues,
    metrics: {
      stage,
      durationMs: Math.max(0, Math.round((nowMs() - startedAt) * 1000) / 1000),
      itemsIn: counts.in,
      itemsOut: counts.out,
      externalCalls: 0,
    },
  };
}

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function issue(
  stage: StageName,
  code: StageIssue["code"],
  detail: string,
  subject?: string
): StageIssue {
  return { stage, code, detail, ...(subject ? { subject } : {}) };
}
