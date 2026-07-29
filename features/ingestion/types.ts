/**
 * Shared ingestion types: diagnostics, results, and evidence-mode classification.
 */

import type { EvidenceSnapshot } from "./snapshot";
import type { CrawlPolicyStatus } from "./robots";

/** How much of an entity's factual evidence is live vs seeded. */
export type EvidenceMode = "seeded" | "mixed" | "live";

/** Structured, log-safe diagnostics for one entity ingestion (Part 13). */
export interface IngestionDiagnostics {
  jobId: string;
  entityId: string;
  adapterId: string;
  urlsAttempted: string[];
  urlsBlocked: string[];
  robotsStatus: CrawlPolicyStatus | "skipped";
  fetchDurationMs: number;
  totalBytes: number;
  pagesOk: number;
  pagesFailed: number;
  snapshotOutcome: "created" | "deduplicated" | "skipped_fresh" | "failed";
  warnings: string[];
  errorClassification: string | null;
}

/** Result of ingesting a single entity. */
export interface EntityIngestionResult {
  entityId: string;
  outcome: "created" | "deduplicated" | "skipped_fresh" | "failed";
  snapshot: EvidenceSnapshot | null;
  diagnostics: IngestionDiagnostics;
}

/** Result of an ingestion run over one or more entities. */
export interface IngestionRunResult {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  requested: number;
  created: number;
  deduplicated: number;
  skippedFresh: number;
  failed: number;
  results: EntityIngestionResult[];
}
