/**
 * Server-side feature flags.
 *
 * Every unfinished product surface is gated here and defaults to OFF, so a
 * deploy that includes the schema does not expose half-built behavior. Flags are
 * read per-call (never cached at module scope) so a platform env change takes
 * effect on the next request without a rebuild.
 *
 * See docs/backend-product-plan.md §9.
 */

export const FEATURE_FLAGS = [
  "FEATURE_SAVED_ITEMS",
  "FEATURE_CONTRIBUTIONS",
  "FEATURE_BUSINESS_ONBOARDING",
  "FEATURE_BUSINESS_CLAIMS",
  "FEATURE_LOCAL_DISCOVERY",
  "FEATURE_JOURNAL_PUBLISHING",
  "FEATURE_DB_ENTITIES",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** True only for an explicit opt-in value. Anything else is off. */
export function isEnabled(flag: FeatureFlag, env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[flag];
  return raw === "on" || raw === "true" || raw === "1";
}

/** Snapshot of every flag — useful for diagnostics and tests. */
export function allFlags(env: NodeJS.ProcessEnv = process.env): Record<FeatureFlag, boolean> {
  return Object.fromEntries(FEATURE_FLAGS.map((f) => [f, isEnabled(f, env)])) as Record<FeatureFlag, boolean>;
}
