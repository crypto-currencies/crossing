import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, verifyPassword, extractCurrentToken } from "@/lib/server/auth";
import { verifyTotpOrBackup, writeSecurityEvent } from "@/lib/server/security";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

const DELETION_GRACE_DAYS = 7;

// ─── POST /api/account/delete ─────────────────────────────────────────────────
// Initiates account deletion. Sets deletionScheduledAt = now().
// The account is hard-deleted by a background job after 7 days.
// Users can cancel within the grace period via DELETE /api/account/delete.
//
// Body: { confirmation: "DELETE", password?: string, totpCode?: string }
//
// Verification rules:
//   - Accounts with a password → password required
//   - Accounts with 2FA enabled → TOTP/backup code required
//   - OAuth-only accounts (no password, no 2FA) → confirmation string is sufficient

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = clientIp(request);
  // 5 attempts per 15 minutes — prevent brute-force on verification step
  if (!await rateLimit(`account-delete:${user.id}:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { confirmation?: unknown; password?: unknown; totpCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Typed confirmation is always required
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  // Fetch full user record for verification
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      deletionScheduledAt: true,
    },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Owners cannot delete their own account to prevent loss of the platform
  if (dbUser.role === "OWNER") {
    return NextResponse.json({ error: "owner_cannot_delete", message: "Transfer ownership before deleting your account." }, { status: 403 });
  }

  // Already scheduled — idempotent: return the existing scheduled date
  if (dbUser.deletionScheduledAt) {
    const deletionDate = new Date(dbUser.deletionScheduledAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    return NextResponse.json({
      ok: true,
      alreadyScheduled: true,
      scheduledAt: dbUser.deletionScheduledAt.toISOString(),
      deletionDate: deletionDate.toISOString(),
    });
  }

  // ── Password verification ──────────────────────────────────────────────────
  if (dbUser.passwordHash) {
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: "password_required" }, { status: 400 });
    }
    if (!verifyPassword(password, dbUser.passwordHash)) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }
  }

  // ── 2FA verification ───────────────────────────────────────────────────────
  if (dbUser.twoFactorEnabled && dbUser.twoFactorSecret) {
    const totpCode = typeof body.totpCode === "string" ? body.totpCode.trim() : "";
    if (!totpCode) {
      return NextResponse.json({ error: "totp_required" }, { status: 400 });
    }
    const ok = await verifyTotpOrBackup(user.id, totpCode, dbUser.twoFactorSecret);
    if (!ok) {
      return NextResponse.json({ error: "invalid_totp" }, { status: 401 });
    }
  }

  // ── Mark deletion ──────────────────────────────────────────────────────────
  const now = new Date();
  await db.user.update({
    where: { id: user.id },
    data:  { deletionScheduledAt: now },
  });

  // Revoke all sessions except the current one so the user stays signed in
  // and can cancel within the grace period.
  const currentToken = extractCurrentToken(request);
  const currentSession = currentToken
    ? await db.session.findUnique({ where: { sessionToken: currentToken }, select: { id: true } })
    : null;
  await db.session.deleteMany({
    where: {
      userId: user.id,
      ...(currentSession ? { id: { not: currentSession.id } } : {}),
    },
  });

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({
    userId: user.id,
    type:   "account_deletion_requested",
    ip,
    userAgent: ua,
    metadata: { scheduledAt: now.toISOString() },
  });

  const deletionDate = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  return NextResponse.json({
    ok: true,
    scheduledAt:  now.toISOString(),
    deletionDate: deletionDate.toISOString(),
  });
}

// ─── DELETE /api/account/delete ───────────────────────────────────────────────
// Cancels a pending deletion request within the grace period.

export async function DELETE(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dbUser = await db.user.findUnique({
    where:  { id: user.id },
    select: { deletionScheduledAt: true },
  });
  if (!dbUser?.deletionScheduledAt) {
    return NextResponse.json({ error: "no_pending_deletion" }, { status: 400 });
  }

  // Check grace period hasn't passed
  const deletionDate = new Date(dbUser.deletionScheduledAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() >= deletionDate) {
    return NextResponse.json({ error: "grace_period_expired" }, { status: 410 });
  }

  await db.user.update({
    where: { id: user.id },
    data:  { deletionScheduledAt: null },
  });

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({
    userId: user.id,
    type:   "account_deletion_cancelled",
    ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true });
}
