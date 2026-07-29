/**
 * Ingestion runtime configuration (merge gating + scheduled refresh).
 *
 * Merge is NEVER global-on by default. Official evidence influences ranking only
 * for entities/categories explicitly allow-listed AND that pass readiness checks
 * (see readiness.ts, merge.ts). The legacy INGESTION_MERGE=on flag is still
 * honored but discouraged.
 */

function csv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Categories explicitly allowed to use official factual evidence. */
export function mergeCategories(env: NodeJS.ProcessEnv = process.env): string[] {
  return csv(env.INGESTION_MERGE_CATEGORIES);
}

/** Individual entities explicitly allowed to use official factual evidence. */
export function mergeEntities(env: NodeJS.ProcessEnv = process.env): string[] {
  return csv(env.INGESTION_MERGE_ENTITIES);
}

/** True when ANY merge scope is configured (global, category, or entity). */
export function anyMergeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INGESTION_MERGE === "on" || mergeCategories(env).length > 0 || mergeEntities(env).length > 0;
}

/**
 * Whether an entity is *allowed* by configuration to merge official evidence.
 * This is the allow-list gate only — readiness is checked separately.
 */
export function mergeAllowed(entityId: string, categoryId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.INGESTION_MERGE === "on") return true; // legacy global (discouraged)
  return mergeCategories(env).includes(categoryId) || mergeEntities(env).includes(entityId);
}

// ─── Scheduled refresh ────────────────────────────────────────────────────────

export interface RefreshConfig {
  /** Max entities processed per cron invocation. */
  batchSize: number;
  /** Soft time budget for one invocation (ms). */
  maxDurationMs: number;
  /** Re-ingest only when the latest good snapshot is older than this (ms). */
  stalenessThresholdMs: number;
  /** Restrict refresh to these categories (empty → all enabled). */
  categories: string[];
  /** Whether failed entities are eligible for retry this run. */
  retryFailed: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** Deterministic, paginated batch selection for the scheduled refresh. */
export function selectRefreshBatch<T extends { entityId: string; categoryId: string }>(
  sources: T[],
  cursor: string | null,
  cfg: Pick<RefreshConfig, "batchSize" | "categories">
): { batch: T[]; nextCursor: string | null; total: number } {
  let s = [...sources];
  if (cfg.categories.length) s = s.filter((x) => cfg.categories.includes(x.categoryId));
  s.sort((a, b) => a.entityId.localeCompare(b.entityId));
  if (cursor) s = s.filter((x) => x.entityId > cursor);
  const batch = s.slice(0, cfg.batchSize);
  const nextCursor = batch.length === cfg.batchSize && s.length > cfg.batchSize ? batch[batch.length - 1].entityId : null;
  return { batch, nextCursor, total: s.length };
}

export function getRefreshConfig(env: NodeJS.ProcessEnv = process.env): RefreshConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    batchSize: num(env.INGESTION_REFRESH_BATCH, 5),
    maxDurationMs: num(env.INGESTION_REFRESH_MAX_MS, 50_000),
    stalenessThresholdMs: num(env.INGESTION_REFRESH_STALE_MS, 7 * DAY),
    categories: csv(env.INGESTION_REFRESH_CATEGORIES),
    retryFailed: env.INGESTION_REFRESH_RETRY_FAILED === "true",
  };
}
