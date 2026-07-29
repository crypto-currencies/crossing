/**
 * Ingestion service — orchestrates adapters over approved entities.
 *
 * Responsibilities: skip fresh evidence, force refresh (admin/dev), deduplicate
 * identical content, record partial failures, continue when one page/entity
 * fails, and emit structured (log-safe) diagnostics. This runs OUT OF BAND — a
 * public recommendation request never calls it (see docs/ingestion.md).
 */

import { randomUUID } from "node:crypto";
import { officialSiteAdapter, type SourceAdapter, type AdapterContext } from "./adapter";
import { getDefaultSnapshotStore, type SnapshotStore } from "./store";
import {
  listApprovedSources,
  listApprovedByCategory,
  getApprovedSource,
  type ApprovedEntitySource,
} from "./registry";
import type { FetchDeps } from "./fetcher";
import type { EntityIngestionResult, IngestionRunResult, IngestionDiagnostics } from "./types";

/** Skip re-ingesting an entity whose latest good snapshot is younger than this. */
export const DEFAULT_FRESH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

export interface IngestionOptions {
  now?: Date;
  /** Fetch + extract but never persist. */
  dryRun?: boolean;
  /** Ignore the skip-fresh window and always re-ingest. */
  force?: boolean;
  freshWithinMs?: number;
  store?: SnapshotStore;
  adapter?: SourceAdapter;
  fetchDeps?: FetchDeps;
  sleep?: (ms: number) => Promise<void>;
  jobId?: string;
  /** Structured, log-safe sink. Defaults to console JSON. */
  logger?: (event: Record<string, unknown>) => void;
}

function defaultLogger(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt: "ingestion", ...event }));
}

function ageMs(iso: string, now: Date): number {
  return now.getTime() - new Date(iso).getTime();
}

async function ingestOne(
  source: ApprovedEntitySource,
  jobId: string,
  opts: IngestionOptions
): Promise<EntityIngestionResult> {
  const now = opts.now ?? new Date();
  const store = opts.store ?? getDefaultSnapshotStore();
  const adapter = opts.adapter ?? officialSiteAdapter;
  const freshWithin = opts.freshWithinMs ?? DEFAULT_FRESH_WITHIN_MS;
  const log = opts.logger ?? defaultLogger;

  // Skip fresh unless forced.
  if (!opts.force) {
    const latestValid = await store.latestValid(source.entityId);
    if (latestValid && ageMs(latestValid.retrievedAt, now) < freshWithin) {
      const diag = baseDiag(jobId, source, "skipped_fresh");
      log({ ...diag, dryRun: !!opts.dryRun });
      return { entityId: source.entityId, outcome: "skipped_fresh", snapshot: latestValid, diagnostics: diag };
    }
  }

  const ctx: AdapterContext = { now, jobId, fetchDeps: opts.fetchDeps, sleep: opts.sleep };

  let snapshot: EntityIngestionResult["snapshot"];
  let diagnostics: IngestionDiagnostics;
  try {
    const run = await adapter.run(source, ctx);
    snapshot = run.snapshot;
    diagnostics = run.diagnostics;
  } catch (e) {
    // An unexpected adapter crash must not abort the whole run.
    diagnostics = baseDiag(jobId, source, "failed");
    diagnostics.errorClassification = "adapter_exception";
    diagnostics.warnings.push(e instanceof Error ? e.message : "unknown adapter error");
    log({ ...diagnostics, dryRun: !!opts.dryRun });
    return { entityId: source.entityId, outcome: "failed", snapshot: null, diagnostics };
  }

  // Failed snapshot: persist it (for the audit error trail) unless dry-run.
  if (!snapshot.ok) {
    diagnostics.snapshotOutcome = "failed";
    if (!opts.dryRun) await store.append(snapshot);
    log({ ...diagnostics, dryRun: !!opts.dryRun });
    return { entityId: source.entityId, outcome: "failed", snapshot, diagnostics };
  }

  // Dedupe identical content against the latest good snapshot.
  const prev = await store.latestValid(source.entityId);
  if (prev && prev.contentFingerprint === snapshot.contentFingerprint) {
    diagnostics.snapshotOutcome = "deduplicated";
    log({ ...diagnostics, dryRun: !!opts.dryRun });
    return { entityId: source.entityId, outcome: "deduplicated", snapshot: prev, diagnostics };
  }

  diagnostics.snapshotOutcome = "created";
  if (!opts.dryRun) await store.append(snapshot);
  log({ ...diagnostics, dryRun: !!opts.dryRun });
  return { entityId: source.entityId, outcome: "created", snapshot, diagnostics };
}

function baseDiag(jobId: string, source: ApprovedEntitySource, outcome: IngestionDiagnostics["snapshotOutcome"]): IngestionDiagnostics {
  return {
    jobId,
    entityId: source.entityId,
    adapterId: (source && "categoryId" in source ? "official-site" : "official-site"),
    urlsAttempted: [],
    urlsBlocked: [],
    robotsStatus: "skipped",
    fetchDurationMs: 0,
    totalBytes: 0,
    pagesOk: 0,
    pagesFailed: 0,
    snapshotOutcome: outcome,
    warnings: [],
    errorClassification: outcome === "failed" ? "unknown" : null,
  };
}

async function runOver(sources: ApprovedEntitySource[], opts: IngestionOptions): Promise<IngestionRunResult> {
  const jobId = opts.jobId ?? randomUUID();
  const startedAt = (opts.now ?? new Date()).toISOString();
  const results: EntityIngestionResult[] = [];

  for (const source of sources) {
    results.push(await ingestOne(source, jobId, opts));
  }

  const tally = (o: EntityIngestionResult["outcome"]) => results.filter((r) => r.outcome === o).length;
  return {
    jobId,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: !!opts.dryRun,
    requested: sources.length,
    created: tally("created"),
    deduplicated: tally("deduplicated"),
    skippedFresh: tally("skipped_fresh"),
    failed: tally("failed"),
    results,
  };
}

// ─── Public entry points ──────────────────────────────────────────────────────

export async function ingestEntity(entityId: string, opts: IngestionOptions = {}): Promise<IngestionRunResult> {
  const source = getApprovedSource(entityId);
  if (!source || !source.enabled) {
    return emptyRun(opts);
  }
  return runOver([source], opts);
}

export async function ingestCategory(categoryId: string, opts: IngestionOptions = {}): Promise<IngestionRunResult> {
  return runOver(listApprovedByCategory(categoryId), opts);
}

export async function ingestAll(opts: IngestionOptions = {}): Promise<IngestionRunResult> {
  return runOver(listApprovedSources(), opts);
}

function emptyRun(opts: IngestionOptions): IngestionRunResult {
  const jobId = opts.jobId ?? randomUUID();
  const nowIso = (opts.now ?? new Date()).toISOString();
  return { jobId, startedAt: nowIso, finishedAt: nowIso, dryRun: !!opts.dryRun, requested: 0, created: 0, deduplicated: 0, skippedFresh: 0, failed: 0, results: [] };
}
