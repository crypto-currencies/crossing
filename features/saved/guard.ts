/**
 * Shared entry guard for every /api/saved/* route.
 *
 * Order matters and is deliberate:
 *   1. Feature flag  — a disabled surface reports 404, never advertising itself.
 *   2. Database      — 503 rather than a raw Prisma failure.
 *   3. Authentication— saved items are always per-user; no anonymous path.
 *   4. Rate limit    — keyed by user, applied only to mutations.
 */

import { DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { isEnabled } from "@/lib/server/feature-flags";
import { fail, ok, type Result } from "@/lib/server/api-result";
import { PrismaSavedStore } from "./prisma-store";
import type { SavedStore } from "./service";

export interface SavedContext {
  userId: string;
  store: SavedStore;
}

/** Reusable store instance — Prisma pools connections internally. */
const defaultStore = new PrismaSavedStore();

export interface GuardOptions {
  /** Applies a per-user write budget. Reads skip this. */
  mutation?: boolean;
  /** Distinguishes budgets (e.g. "save" vs "collection"). */
  bucket?: string;
}

export async function guardSavedRequest(
  request: Request,
  options: GuardOptions = {}
): Promise<Result<SavedContext>> {
  if (!isEnabled("FEATURE_SAVED_ITEMS")) {
    return fail("feature_disabled", "Saved items are not available yet.");
  }
  if (!DB_AVAILABLE) {
    return fail("db_unavailable", "Saved items are temporarily unavailable.");
  }

  const user = await requireAuth(request);
  if (!user) {
    return fail("unauthenticated", "Sign in to save results.");
  }
  if (user.suspendedAt) {
    return fail("forbidden", "This account is suspended.");
  }

  if (options.mutation) {
    const bucket = options.bucket ?? "write";
    const allowed = await rateLimit(`saved:${bucket}:${user.id}`, 60, 60_000);
    if (!allowed) {
      return fail("rate_limited", "You're doing that too quickly. Give it a moment.");
    }
  }

  return ok({ userId: user.id, store: defaultStore });
}

/** Parse a JSON body, returning a structured error instead of throwing. */
export async function readJson(request: Request): Promise<Result<unknown>> {
  try {
    return ok(await request.json());
  } catch {
    return fail("invalid_body", "Request body must be valid JSON.");
  }
}
