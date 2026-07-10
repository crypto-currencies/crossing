/**
 * Step-up verification — server-side session guard.
 *
 * Call `requireStepUp(adminId)` inside any sensitive route handler AFTER the
 * role check. If it returns false, respond with 403 + error:"step_up_required".
 *
 * The verified window is stored in `AdminVerificationSession` (DB), so the
 * client can never self-issue a verified state.
 *
 * Session lifetime: SESSION_TTL_MS after a successful OTP confirmation.
 * The session row is upserted — one row per admin, replaced on new verify.
 */

import { db } from "@/lib/db";

export const SESSION_TTL_MS  = 10 * 60 * 1000; // 10 minutes
export const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS     = 5;              // wrong-code attempts before invalidation
export const RATE_LIMIT_COUNT = 3;              // max challenges per window
export const RATE_LIMIT_MS    = 15 * 60 * 1000; // 15-minute window

/**
 * Returns true when the given admin has a non-expired step-up session.
 * Always hits the DB — never trusts client claims.
 */
export async function requireStepUp(adminId: string): Promise<boolean> {
  try {
    const session = await db.adminVerificationSession.findUnique({
      where: { adminId },
    });
    if (!session) return false;
    return session.expiresAt > new Date();
  } catch {
    return false; // DB error → deny
  }
}

/**
 * Creates (or renews) the verified session for an admin.
 * Returns the new expiresAt timestamp.
 */
export async function grantStepUpSession(adminId: string): Promise<Date> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.adminVerificationSession.upsert({
    where:  { adminId },
    update: { expiresAt, updatedAt: new Date() },
    create: { adminId, expiresAt },
  });
  return expiresAt;
}

/**
 * Returns seconds remaining in the admin's step-up session, or 0 if expired/absent.
 */
export async function stepUpSecondsLeft(adminId: string): Promise<number> {
  try {
    const session = await db.adminVerificationSession.findUnique({
      where: { adminId },
    });
    if (!session || session.expiresAt <= new Date()) return 0;
    return Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  } catch {
    return 0;
  }
}
