/**
 * Data-mode guard.
 *
 * Phase 2 still serves SEEDED (mock) evidence. This module makes that fact
 * explicit and prevents seeded data from ever being silently served as if it
 * were live production data:
 *
 *   - In development/preview, seeded data is allowed and disclosed.
 *   - In production, seeded data is REFUSED unless `ALLOW_SEEDED_DATA=true` is
 *     explicitly set. If it is set (i.e. the mock pipeline was intentionally or
 *     accidentally enabled in prod), the response is still clearly disclosed —
 *     it is never passed off as live.
 *
 * When a real evidence pipeline lands, flip DATA_MODE to "live" and the guard
 * becomes a no-op.
 */

export type DataMode = "seeded" | "live";

/** The only data source that exists today. */
export const DATA_MODE: DataMode = "seeded";

export interface DataModeStatus {
  mode: DataMode;
  /** True when the response must carry a "prototype / seeded evidence" disclosure. */
  disclose: boolean;
  /** False → the caller must refuse to serve (seeded data blocked in prod). */
  allowed: boolean;
}

/**
 * Resolve whether seeded data may be served in the current environment, and
 * whether it must be disclosed. Pure aside from reading env — callers pass the
 * env explicitly in tests.
 */
export function resolveDataMode(env: NodeJS.ProcessEnv = process.env): DataModeStatus {
  if (DATA_MODE === "live") {
    return { mode: "live", disclose: false, allowed: true };
  }

  const isProd = env.NODE_ENV === "production";
  const explicitlyAllowed = env.ALLOW_SEEDED_DATA === "true";

  // Non-prod: always allowed, always disclosed.
  if (!isProd) return { mode: "seeded", disclose: true, allowed: true };

  // Prod: only if explicitly opted in — and then still disclosed, never silent.
  return { mode: "seeded", disclose: explicitlyAllowed, allowed: explicitlyAllowed };
}
