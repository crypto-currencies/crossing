/**
 * Snapshot-store health detection.
 *
 * The admin evidence tool reads a Prisma-backed table that only exists after
 * `prisma migrate deploy` has run. Rather than crashing with a raw
 * PrismaClientKnownRequestError overlay, the page detects that specific
 * condition and renders an actionable operator message.
 */

/** True when the error means the backing table has not been migrated yet. */
export function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "P2021") return true; // Prisma: "The table does not exist in the current database."
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /does not exist in the current database/i.test(message);
}

/** True when the database itself is unreachable / not configured. */
export function isDatabaseUnavailableError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "P1001" || code === "P1000" || code === "P1017") return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /can'?t reach database server|connection refused|ECONNREFUSED/i.test(message);
}

export interface StoreHealthProblem {
  kind: "missing_table" | "db_unavailable";
  title: string;
  detail: string;
  remedy: string;
}

/** Classify an error into an operator-facing problem, or null if it's unexpected. */
export function classifyStoreError(err: unknown): StoreHealthProblem | null {
  if (isMissingTableError(err)) {
    return {
      kind: "missing_table",
      title: "Evidence storage is not migrated yet",
      detail:
        "The EvidenceSnapshot table does not exist in the connected database, so no snapshot history can be read.",
      remedy: "Run `npx prisma migrate deploy` against this database (local dev: `npx prisma migrate dev`), then reload.",
    };
  }
  if (isDatabaseUnavailableError(err)) {
    return {
      kind: "db_unavailable",
      title: "Database unreachable",
      detail: "The evidence store could not connect to the configured database.",
      remedy: "Check DATABASE_URL and that the database accepts connections, then reload.",
    };
  }
  return null;
}
