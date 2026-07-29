/**
 * Access gating for the ingestion trigger + evidence audit tool.
 *
 * The tool is development-first. In production it is disabled unless explicitly
 * enabled (INGESTION_ALLOW_PROD=true), and even then it requires an ADMIN/OWNER
 * session. It is never publicly callable and is never indexed.
 */

export function ingestionToolEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.INGESTION_ALLOW_PROD === "true";
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}
