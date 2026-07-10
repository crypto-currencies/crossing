/**
 * Server-only auth utilities.
 * Import only from API routes, server actions, and server components — never from client code.
 */

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getToken } from "next-auth/jwt";
import type { User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

// ─── Role definitions ─────────────────────────────────────────────────────────
// Defined locally so the helpers work even before `prisma generate` has been
// re-run after adding the UserRole enum to the schema.

/** Platform role string union — mirrors the Prisma UserRole enum. */
export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "OWNER";

/** Numeric rank for each role — higher number = more privileged. */
const ROLE_RANK: Record<UserRole, number> = {
  USER:      0,
  MODERATOR: 1,
  ADMIN:     2,
  OWNER:     3,
};

/**
 * Safely reads the role from any object (pre- or post-migration Prisma User,
 * or a plain object). Defaults to "USER" when the field is absent.
 */
function extractRole(user: object): UserRole {
  const raw = (user as Record<string, unknown>)["role"];
  if (typeof raw === "string" && raw in ROLE_RANK) return raw as UserRole;
  return "USER";
}

/**
 * Returns true if `user` has at least the privileges of `minRole`.
 * Accepts the Prisma User, a mapped domain User, or any plain object.
 */
export function userHasRole(user: object, minRole: UserRole): boolean {
  return (ROLE_RANK[extractRole(user)] ?? 0) >= ROLE_RANK[minRole];
}

/** Convenience: true if the user is ADMIN or OWNER. */
export function isAdmin(user: object): boolean {
  return userHasRole(user, "ADMIN");
}

/** Convenience: true only if the user is OWNER. */
export function isOwner(user: object): boolean {
  return extractRole(user) === "OWNER";
}

/**
 * Guard against privilege escalation. Returns true only if actor outranks target.
 * - OWNER  can modify ADMIN / MODERATOR / USER
 * - ADMIN  can modify MODERATOR / USER only (not peer ADMINs)
 * - Others cannot modify anyone
 *
 * Usage in admin API routes:
 *   if (!canModifyUser(actor, target)) return 403
 */
export function canModifyUser(actor: object, target: object): boolean {
  return ROLE_RANK[extractRole(actor)] > ROLE_RANK[extractRole(target)];
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Thrown by createSession when the target account is suspended.
 * Every auth flow (credentials, OAuth bridge, magic link) creates sessions
 * through createSession, so this is the single chokepoint that guarantees
 * a suspended account can never be issued a new session token.
 */
export class SuspendedAccountError extends Error {
  constructor() {
    super("account_suspended");
    this.name = "SuspendedAccountError";
  }
}

// ─── Password hashing ─────────────────────────────────────────────────────────

/** Returns `salt:hash` string using scrypt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Timing-safe password verification. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const testBuf = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuf, testBuf);
  } catch {
    return false;
  }
}

// ─── Session management ───────────────────────────────────────────────────────

export interface SessionMeta {
  userAgent?:  string;
  ipHash?:     string;
  maskedIp?:   string;
  deviceHint?: string;
}

/**
 * Creates a new session record and returns the token.
 * @throws SuspendedAccountError if the account is suspended — callers must
 *         handle this and return 403 (API) or redirect with an error (pages).
 */
export async function createSession(userId: string, meta?: SessionMeta): Promise<string> {
  // Hard gate: never issue a session to a suspended account, regardless of
  // which auth flow (credentials / OAuth / magic link) is asking.
  const account = await db.user.findUnique({
    where:  { id: userId },
    select: { suspendedAt: true },
  });
  if (account?.suspendedAt) throw new SuspendedAccountError();

  const token   = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires,
      userAgent:  meta?.userAgent  ?? null,
      ipHash:     meta?.ipHash     ?? null,
      maskedIp:   meta?.maskedIp   ?? null,
      deviceHint: meta?.deviceHint ?? null,
    },
  });
  return token;
}

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000; // update at most once per 5 minutes

/** Validates a token and returns the associated user, or null if invalid/expired. */
export async function validateSession(
  token: string | null | undefined
): Promise<User | null> {
  if (!token) return null;
  try {
    const session = await db.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expires < new Date()) {
      await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
      return null;
    }
    // Throttled lastSeen update — fire-and-forget, never blocks the request
    if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      db.session.update({
        where: { sessionToken: token },
        data:  { lastSeenAt: new Date() },
      }).catch(() => {});
    }
    return session.user;
  } catch {
    return null;
  }
}

/** Extracts the bearer token from an Authorization header. */
export function extractBearerToken(
  request: Request
): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/** Reads the session_token httpOnly cookie from the Cookie header. */
function extractSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const raw of cookieHeader.split(";")) {
    const eqIdx = raw.indexOf("=");
    if (eqIdx === -1) continue;
    const name = raw.slice(0, eqIdx).trim();
    const value = raw.slice(eqIdx + 1).trim();
    if (name === SESSION_COOKIE && value) {
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return null;
}

/**
 * Validates the session from a request and returns the user.
 * Checks Bearer token first, then falls back to the session_token cookie
 * so OAuth users (no Bearer) can also make authenticated API requests.
 */
export async function requireAuth(request: Request): Promise<User | null> {
  // 1. Bearer token — standard for email/password sessions
  const bearerToken = extractBearerToken(request);
  if (bearerToken) return validateSession(bearerToken);

  // 2. Session cookie — fallback for OAuth / cookie-only sessions
  const cookieToken = extractSessionCookie(request);
  return validateSession(cookieToken);
}

/** Deletes a session by token (sign-out). */
export async function deleteSession(token: string): Promise<void> {
  await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
}

/**
 * Returns the raw session token from the request (Bearer or cookie).
 * Useful for identifying which session is "current" when listing all sessions.
 */
export function extractCurrentToken(request: Request): string | null {
  return extractBearerToken(request) ?? extractSessionCookie(request);
}

/**
 * Returns true if the user account is currently suspended.
 * Safe to call with any object — casts internally so callers don't need to.
 */
export function isSuspended(user: object): boolean {
  return !!((user as Record<string, unknown>).suspendedAt);
}

// ─── Role-scoped auth helpers (API routes) ────────────────────────────────────

/**
 * Like `requireAuth` but also enforces a minimum role.
 * Returns the user if authenticated and authorized, or null otherwise.
 *
 * Callers distinguish unauthenticated vs. unauthorized via the user result:
 *   - null from requireAuth  → 401 Unauthorized
 *   - null from role check   → 403 Forbidden
 *
 * For convenience, this always returns null on either failure so callers
 * can return a consistent 403 for admin routes (avoids leaking route existence).
 */
export async function requireRole(
  request: Request,
  minRole: UserRole
): Promise<User | null> {
  const user = await requireAuth(request);
  if (!user) return null;
  return userHasRole(user, minRole) ? user : null;
}

/**
 * Require the caller to be ADMIN or OWNER.
 * Use in API routes that back the admin dashboard.
 */
export async function requireAdmin(request: Request): Promise<User | null> {
  return requireRole(request, "ADMIN");
}

/**
 * Require the caller to be OWNER.
 * Use in API routes that only platform owners should access
 * (e.g. granting/revoking ADMIN role).
 */
export async function requireOwner(request: Request): Promise<User | null> {
  return requireRole(request, "OWNER");
}

// ─── Server Component helper ──────────────────────────────────────────────────

/**
 * Reads the session from the httpOnly cookie and returns the authenticated user.
 * For use in async Server Components and layouts — NOT in API route handlers.
 *
 * Example (admin page):
 *   const user = await getServerUser();
 *   if (!user || !isAdmin(user)) notFound();
 */
export async function getServerUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    return validateSession(token);
  } catch {
    // cookies() throws outside a request context (e.g. during static generation)
    return null;
  }
}

