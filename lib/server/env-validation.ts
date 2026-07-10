/**
 * Startup environment validation.
 *
 * Called once from instrumentation.ts register() when the Node.js server boots.
 * Production: throws on any missing required variable — the deploy fails fast
 * instead of silently degrading (no rate limiting, broken emails, open cron).
 * Development: logs a warning listing what's missing and continues.
 */

interface EnvVarSpec {
  name: string;
  /** Why the variable is required — included in the error message. */
  reason: string;
}

const REQUIRED_IN_PRODUCTION: EnvVarSpec[] = [
  { name: "DATABASE_URL",             reason: "Postgres connection — nothing works without it" },
  { name: "OWNER_EMAIL",              reason: "owner bootstrap — platform has no OWNER without it" },
  { name: "BLOB_READ_WRITE_TOKEN",    reason: "file uploads return 503 without it" },
  { name: "CRON_SECRET",              reason: "deletion cron endpoint is disabled without it" },
  { name: "RESEND_API_KEY",           reason: "magic link, password reset, verification, and admin OTP emails" },
  { name: "EMAIL_FROM",               reason: "sender address for all transactional email" },
  { name: "UPSTASH_REDIS_REST_URL",   reason: "rate limiting is silently disabled without it — all endpoints become unthrottled" },
  { name: "UPSTASH_REDIS_REST_TOKEN", reason: "rate limiting is silently disabled without it — all endpoints become unthrottled" },
];

// "At least one of" groups.
// Auth secret: NEXTAUTH_SECRET is used by the existing codebase; AUTH_SECRET
// is the NextAuth v5 / Auth.js equivalent. Either satisfies the requirement.
// Base URL: getBaseUrl() (lib/server/url.ts) resolves the canonical origin and
// hard-defaults to https://crossing.dev in production. NEXTAUTH_URL is still
// required so NextAuth builds correct OAuth sign-in callbacks.
const REQUIRED_ONE_OF: { names: string[]; reason: string }[] = [
  {
    names: ["NEXTAUTH_SECRET", "AUTH_SECRET"],
    reason: "JWT encryption, session signing, and OAuth state signing — NEXTAUTH_SECRET is used by this codebase",
  },
  {
    names: ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"],
    reason: "base URL for OAuth callbacks and email links",
  },
];

export function validateEnv(): void {
  const missing = REQUIRED_IN_PRODUCTION.filter(
    (spec) => !process.env[spec.name]?.trim()
  );

  const missingGroups = REQUIRED_ONE_OF.filter(
    (group) => !group.names.some((n) => process.env[n]?.trim())
  );

  if (missing.length === 0 && missingGroups.length === 0) return;

  const lines = [
    ...missing.map((s) => `  - ${s.name}: ${s.reason}`),
    ...missingGroups.map((g) => `  - one of [${g.names.join(", ")}]: ${g.reason}`),
  ];

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Missing required environment variables in production:\n${lines.join("\n")}\n` +
      `See .env.example for documentation on each variable.`
    );
  }

  console.warn(
    `[env] Missing environment variables (OK in development, fatal in production):\n${lines.join("\n")}`
  );
}
