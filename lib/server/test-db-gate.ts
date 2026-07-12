/**
 * Use `dbTest` in place of `test` from node:test for cases that need a real
 * database connection (duplicate-constraint behavior, authorization against
 * real rows, etc). Skips — never fails — when DATABASE_URL isn't configured,
 * matching this codebase's fail-open-without-infra philosophy elsewhere
 * (see lib/server/rate-limit.ts). Run `npm test` again once DATABASE_URL
 * points at a real (throwaway/dev) Postgres to actually exercise these.
 */

import { test } from "node:test";
import { DB_AVAILABLE } from "@/lib/db";

export const dbTest: typeof test = DB_AVAILABLE ? test : (test.skip as typeof test);
