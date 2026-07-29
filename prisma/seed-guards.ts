/**
 * Seed safety guards (SEC-003).
 *
 * Kept in their own module so they can be unit-tested without importing
 * `seed.ts`, which instantiates a PrismaClient at module scope and would
 * therefore require a live DATABASE_URL just to test a pure function.
 */

import { randomBytes } from "crypto";

/** Gitignored sink for a generated demo password. */
export const DEMO_CREDENTIALS_FILE = ".seed-credentials";

export class SeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedRefusedError";
  }
}

/**
 * Throws unless seeding is permitted in this environment.
 *
 * The seed writes demo accounts and FIXTURE engagement counts, neither of which
 * belongs in production — and `npm run db:seed` picks up whatever DATABASE_URL
 * happens to be exported, so the guard lives in code rather than relying on the
 * operator noticing.
 *
 * Env is injectable so the guard is testable without mutating the real process
 * environment.
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  // Strict equality on purpose: "1", "yes", "TRUE" must NOT unlock production.
  if (env.SEED_ALLOW_PROD !== "true") {
    throw new SeedRefusedError(
      "Refusing to seed a production database.\n" +
        "This script creates demo accounts and fixture engagement counts that must " +
        "never appear in production.\n" +
        "If you are certain, re-run with SEED_ALLOW_PROD=true.",
    );
  }

  // Override honored — make it impossible to miss in a terminal or a CI log.
  console.warn(
    "\n" +
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
      "!!  WARNING: SEEDING A PRODUCTION DATABASE                        !!\n" +
      "!!  SEED_ALLOW_PROD=true was set, so the safety guard is bypassed. !!\n" +
      "!!  This will write demo users and FIXTURE engagement counts.      !!\n" +
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n",
  );
}

/**
 * Resolve the demo account password.
 *
 * `SEED_DEMO_PASSWORD` pins a known value for local convenience; otherwise a
 * random one is minted per run. Nothing is ever committed to source.
 */
export function resolveDemoPassword(env: NodeJS.ProcessEnv = process.env): {
  password: string;
  generated: boolean;
} {
  const provided = env.SEED_DEMO_PASSWORD?.trim();
  if (provided) return { password: provided, generated: false };
  return { password: `demo-${randomBytes(18).toString("base64url")}`, generated: true };
}
