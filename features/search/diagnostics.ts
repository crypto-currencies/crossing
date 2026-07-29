/**
 * Per-search diagnostics (Part 14).
 *
 * Everything an operator needs to answer "why did this search return that?" —
 * and nothing a user ever sees. `SearchDiagnostics` is attached to a response
 * only in development or for an admin caller; `redactForProduction` is the
 * chokepoint that enforces it.
 *
 * The raw query is included in the dev object but stripped from the production
 * log line, where only its length is recorded.
 */

import type { StageIssue, StageMetrics } from "./contracts";
import type { AgenticTrace } from "./discovery/agentic";
import type { BudgetSnapshot } from "./providers/registry";
import type { ResolutionOutcome } from "./resolution/resolve";

export interface SearchDiagnostics {
  requestId: string;
  /** The user's raw query. Development/admin only. */
  query: string;
  categoryId: string | null;
  domain: string;
  /** The gate's internal status — engineering vocabulary lives here, not in copy. */
  resolutionStatus: string;

  // Discovery
  discoveryAdapters: string[];
  discoveryLayers: string[];
  searchQueriesIssued: string[];
  rawCandidateCount: number;
  dedupedCandidateCount: number;

  // Resolution
  resolutionCounts: Record<ResolutionOutcome["kind"], number>;
  candidatesRejected: number;

  // Evidence
  evidenceSourceCount: number;
  entitiesWithIndependentEvidence: number;

  // Performance
  stageMetrics: StageMetrics[];
  providerDurationMs: number;
  rankingDurationMs: number;
  totalDurationMs: number;

  // Cache
  cacheHits: { query: boolean; discovery: boolean; evidence: number };

  // Cost
  budget: BudgetSnapshot;
  estimatedCostUsd: number;

  // Failures
  partialFailures: StageIssue[];

  // Outcome
  finalResultCount: number;

  /** Present only when the agentic layer ran. */
  agenticTrace?: AgenticTrace;
}

export interface DiagnosticsInput {
  requestId: string;
  query: string;
  categoryId: string | null;
  domain: string;
  resolutionStatus: string;
  discoveryAdapters?: string[];
  discoveryLayers?: string[];
  searchQueriesIssued?: string[];
  rawCandidateCount?: number;
  dedupedCandidateCount?: number;
  resolutionCounts?: Record<ResolutionOutcome["kind"], number>;
  evidenceSourceCount?: number;
  entitiesWithIndependentEvidence?: number;
  stageMetrics?: StageMetrics[];
  providerDurationMs?: number;
  rankingDurationMs?: number;
  totalDurationMs?: number;
  cacheHits?: { query: boolean; discovery: boolean; evidence: number };
  budget: BudgetSnapshot;
  estimatedCostUsd?: number;
  partialFailures?: StageIssue[];
  finalResultCount?: number;
  agenticTrace?: AgenticTrace;
}

const NO_COUNTS: Record<ResolutionOutcome["kind"], number> = {
  canonical: 0,
  "new-unresolved": 0,
  "probable-duplicate": 0,
  rejected: 0,
};

export function buildDiagnostics(input: DiagnosticsInput): SearchDiagnostics {
  const counts = input.resolutionCounts ?? NO_COUNTS;
  return {
    requestId: input.requestId,
    query: input.query,
    categoryId: input.categoryId,
    domain: input.domain,
    resolutionStatus: input.resolutionStatus,
    discoveryAdapters: input.discoveryAdapters ?? [],
    discoveryLayers: input.discoveryLayers ?? [],
    searchQueriesIssued: input.searchQueriesIssued ?? [],
    rawCandidateCount: input.rawCandidateCount ?? 0,
    dedupedCandidateCount: input.dedupedCandidateCount ?? 0,
    resolutionCounts: counts,
    candidatesRejected: counts.rejected,
    evidenceSourceCount: input.evidenceSourceCount ?? 0,
    entitiesWithIndependentEvidence: input.entitiesWithIndependentEvidence ?? 0,
    stageMetrics: input.stageMetrics ?? [],
    providerDurationMs: input.providerDurationMs ?? 0,
    rankingDurationMs: input.rankingDurationMs ?? 0,
    totalDurationMs: input.totalDurationMs ?? 0,
    cacheHits: input.cacheHits ?? { query: false, discovery: false, evidence: 0 },
    budget: input.budget,
    estimatedCostUsd: input.estimatedCostUsd ?? input.budget.costUsd,
    partialFailures: input.partialFailures ?? [],
    finalResultCount: input.finalResultCount ?? 0,
    ...(input.agenticTrace ? { agenticTrace: input.agenticTrace } : {}),
  };
}

/**
 * Whether this caller may see the full trace. Development always may; in
 * production only an explicitly-flagged admin caller does.
 */
export function maySeeDiagnostics(env: NodeJS.ProcessEnv, isAdmin = false): boolean {
  return env.NODE_ENV !== "production" || isAdmin;
}

/**
 * The production structured log line. Query TEXT is deliberately replaced by
 * its length — search queries can carry personal detail and do not belong in
 * durable logs.
 */
export function toLogLine(d: SearchDiagnostics, includeQuery: boolean): Record<string, unknown> {
  return {
    evt: "search.run",
    requestId: d.requestId,
    ...(includeQuery ? { query: d.query } : { queryLength: d.query.length }),
    categoryId: d.categoryId,
    domain: d.domain,
    resolutionStatus: d.resolutionStatus,
    adapters: d.discoveryAdapters,
    queriesIssued: d.searchQueriesIssued.length,
    rawCandidates: d.rawCandidateCount,
    dedupedCandidates: d.dedupedCandidateCount,
    rejected: d.candidatesRejected,
    evidenceSources: d.evidenceSourceCount,
    withIndependent: d.entitiesWithIndependentEvidence,
    providerMs: d.providerDurationMs,
    rankingMs: d.rankingDurationMs,
    totalMs: d.totalDurationMs,
    cacheHitQuery: d.cacheHits.query,
    cacheHitDiscovery: d.cacheHits.discovery,
    costUsd: d.estimatedCostUsd,
    budgetExhaustedBy: d.budget.exhaustedBy,
    partialFailures: d.partialFailures.length,
    results: d.finalResultCount,
  };
}
