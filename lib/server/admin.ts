/**
 * Centralized admin / owner detection.
 *
 * The platform owner is identified by matching the OWNER_EMAIL env var against
 * the user's email address. On first access, if the DB row doesn't yet have
 * role=OWNER, this module upgrades it automatically (bootstrap).
 *
 * All subsequent permission checks trust the DB `role` column only —
 * OWNER_EMAIL is only used for the one-time bootstrap.
 *
 * Import paths:
 *   Server Components  → import { getAdminUser } from "@/lib/server/admin"
 *   API route handlers → import { requireAdminApi, requireOwnerApi } from "@/lib/server/admin"
 */

import { db } from "@/lib/db";
import {
  requireAuth,
  isAdmin,
  isOwner,
} from "@/lib/server/auth";
import type { User } from "@prisma/client";

// ─── Owner credentials ────────────────────────────────────────────────────────
// Admin access is granted ONLY by verified email — never by username.
// The email is the single source of truth for owner bootstrap.

export const OWNER_EMAIL: string = process.env.OWNER_EMAIL ?? "";

/**
 * True when the given user's email matches the owner email.
 * Case-insensitive. Username is deliberately not checked — it can be changed
 * by anyone, making it an unsafe identifier for privilege escalation.
 */
export function matchesOwnerCredentials(user: {
  email?: string | null;
}): boolean {
  const email = user.email?.trim().toLowerCase() ?? "";
  return email !== "" && email === OWNER_EMAIL.toLowerCase();
}

/**
 * If `user` matches the owner credentials but doesn't yet have role=OWNER,
 * upgrades the row in-place and returns the updated record.
 * Safe to call on every authenticated request — no-op in steady state.
 */
async function bootstrapOwnerRole(user: User): Promise<User> {
  if (!matchesOwnerCredentials(user)) return user;
  if (isOwner(user)) return user;

  const upgraded = await db.user.update({
    where: { id: user.id },
    data:  { role: "OWNER" },
  });
  return upgraded;
}

// ─── API route helpers ────────────────────────────────────────────────────────

/**
 * Validates the request, performs a fresh DB read (so stale session tokens
 * can't carry a lower role), auto-promotes the owner account if needed, then
 * checks the caller meets `minRole`.
 *
 * Returns the DB user on success, or `null` on any failure.
 * Callers should respond with 403 on null — never 401 — to avoid leaking
 * whether the route exists.
 */
async function requireFreshRole(
  request: Request,
  minRole: "ADMIN" | "OWNER"
): Promise<User | null> {
  // 1. Validate session / bearer token
  const sessionUser = await requireAuth(request);
  if (!sessionUser) return null;

  // 2. Fresh DB read — session may cache a stale role
  let user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return null;

  // 3. Bootstrap OWNER role from credentials if needed
  user = await bootstrapOwnerRole(user);

  // 4. Suspended accounts lose all elevated access
  if (user.suspendedAt) return null;

  // 5. Role check
  if (minRole === "OWNER") return isOwner(user) ? user : null;
  return isAdmin(user) ? user : null;
}

/**
 * Require ADMIN or OWNER for an API route handler.
 * Returns 403 (not 401) so the route's existence isn't leaked to unauthenticated callers.
 */
export async function requireAdminApi(request: Request): Promise<User | null> {
  return requireFreshRole(request, "ADMIN");
}

/**
 * Require OWNER for an API route handler.
 */
export async function requireOwnerApi(request: Request): Promise<User | null> {
  return requireFreshRole(request, "OWNER");
}

// ─── Server Component / Layout helper ────────────────────────────────────────

/**
 * For use in async Server Components and layouts.
 *
 * Auth resolution order:
 *   1. Custom `session_token` httpOnly cookie  (email/password + new OAuth logins)
 *   2. NextAuth JWT cookie fallback            (OAuth sessions established before
 *                                               google-token started setting the cookie)
 *
 * Returns a fresh DB user with owner role bootstrapped, or null.
 */
export async function getAdminUser(): Promise<User | null> {
  const { cookies }         = await import("next/headers");
  const { SESSION_COOKIE }  = await import("@/lib/server/session-cookie");
  const { validateSession } = await import("@/lib/server/auth");

  try {
    const cookieStore = await cookies();

    // ── Path 1: custom DB session cookie ──────────────────────────────────────
    const customToken = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    if (customToken) {
      const sessionUser = await validateSession(customToken);
      if (sessionUser) {
        let user = await db.user.findUnique({ where: { id: sessionUser.id } });
        if (user) {
          user = await bootstrapOwnerRole(user);
          if (user.suspendedAt) return null;
          return user;
        }
      }
    }

    // ── Path 2: NextAuth JWT fallback (OAuth users without the custom cookie) ──
    // Build a minimal req-like object so next-auth/jwt can read its own cookie.
    const { getToken } = await import("next-auth/jwt");
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const nextAuthToken = await getToken({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req:    { headers: { cookie: cookieHeader }, cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])) } as any,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });

    const userId = nextAuthToken?.userId as string | undefined;
    if (!userId) return null;

    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    user = await bootstrapOwnerRole(user);
    if (user.suspendedAt) return null;
    return user;
  } catch {
    return null;
  }
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

export interface AuditPayload {
  adminId:      string;
  action:       string;
  targetUserId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?:    Record<string, any>;
}

export async function writeAuditLog(entry: AuditPayload): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId:      entry.adminId,
        action:       entry.action,
        targetUserId: entry.targetUserId ?? null,
        // Prisma's Json? field: omit the key entirely to get SQL NULL
        ...(entry.metadata != null ? { metadata: entry.metadata } : {}),
      },
    });
  } catch {
    // Audit log failure must never break the primary action
  }
}
