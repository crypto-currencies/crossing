import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { createSession } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { hashIp, maskIp, parseDevice, writeSecurityEvent, verifyTotpOrBackup } from "@/lib/server/security";

// ─── POST /api/auth/login/2fa ─────────────────────────────────────────────────
// Second step of 2FA-protected password login.
// Body: { pendingToken: string, code: string }
//
// Flow:
//   1. Validate the short-lived pending token (5-minute TTL, single-use).
//   2. Verify the TOTP or backup code against the user's secret.
//   3. Consume the pending token and create a real session.
//
// A full session is NEVER issued until this endpoint succeeds.

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  // 10 attempts per 15 minutes per IP — brute-force protection on the TOTP window
  if (!await rateLimit(`login-2fa:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { pendingToken?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken.trim() : "";
  const code         = typeof body.code         === "string" ? body.code.trim()         : "";

  if (!pendingToken || !code) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // ── Validate pending token ─────────────────────────────────────────────────
  const tokenHash = createHash("sha256").update(pendingToken).digest("hex");
  const pending = await db.pendingLogin.findUnique({ where: { tokenHash } });

  if (!pending) {
    return NextResponse.json({ error: "invalid_pending_token" }, { status: 400 });
  }

  if (pending.expiresAt < new Date()) {
    await db.pendingLogin.delete({ where: { tokenHash } }).catch(() => {});
    return NextResponse.json({ error: "pending_token_expired" }, { status: 400 });
  }

  // ── Fetch user's 2FA secret ────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where:  { id: pending.userId },
    select: {
      id:               true,
      twoFactorEnabled: true,
      twoFactorSecret:  true,
      suspendedAt:      true,
    },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    // 2FA was disabled between login step and this step — clean up and reject
    await db.pendingLogin.delete({ where: { tokenHash } }).catch(() => {});
    return NextResponse.json({ error: "2fa_not_configured" }, { status: 400 });
  }

  if (user.suspendedAt) {
    await db.pendingLogin.delete({ where: { tokenHash } }).catch(() => {});
    void writeSecurityEvent({ userId: user.id, type: "login_failed", ip, userAgent: ua,
      metadata: { reason: "suspended_at_2fa_step" } });
    return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  }

  // ── Verify TOTP or backup code ─────────────────────────────────────────────
  const result = await verifyTotpOrBackup(user.id, code, user.twoFactorSecret);

  if (!result) {
    void writeSecurityEvent({ userId: user.id, type: "login_failed", ip, userAgent: ua,
      metadata: { reason: "invalid_totp" } });

    // Increment failure counter. Delete the pending token after 5 failed attempts so
    // the user must restart the login flow — prevents TOTP brute-force even across IPs.
    //
    // IMPORTANT: use explicit try/catch, not .catch(() => null). If the update
    // fails (e.g. migration not yet applied, transient DB error), we must NOT
    // delete the pending login — that would lock the user out on the first wrong
    // attempt. Return invalid_code and let the next attempt succeed normally.
    const MAX_TOTP_FAILURES = 5;
    let newFailedAttempts: number;
    try {
      const updated = await db.pendingLogin.update({
        where:  { tokenHash },
        data:   { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      });
      newFailedAttempts = updated.failedAttempts;
    } catch {
      return NextResponse.json({ error: "invalid_code" }, { status: 401 });
    }

    if (newFailedAttempts >= MAX_TOTP_FAILURES) {
      await db.pendingLogin.delete({ where: { tokenHash } }).catch(() => {});
      return NextResponse.json({ error: "too_many_attempts" }, { status: 401 });
    }

    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  // ── Consume pending token (single-use) ────────────────────────────────────
  await db.pendingLogin.delete({ where: { tokenHash } }).catch(() => {});

  // ── Create real session ───────────────────────────────────────────────────
  const device   = parseDevice(ua);
  const token    = await createSession(user.id, {
    userAgent:  ua,
    ipHash:     hashIp(ip),
    maskedIp:   maskIp(ip),
    deviceHint: device.hint,
  });
  const session = await db.session.findUnique({ where: { sessionToken: token } });

  if (!session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  // Fetch the full user for the response mapper
  const fullUser = await db.user.findUnique({ where: { id: user.id } });

  void writeSecurityEvent({ userId: user.id, type: "login", ip, userAgent: ua,
    metadata: { device: device.hint, method: result === "backup" ? "backup_code" : "totp" } });

  const response = NextResponse.json({
    token,
    expiresAt: session.expires.toISOString(),
    user: mapUser(fullUser!, { includeEmail: true }),
  });

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(session.expires));
  return response;
}
