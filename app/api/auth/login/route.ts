import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { hashIp, maskIp, parseDevice, writeSecurityEvent } from "@/lib/server/security";

/** One-way identifier key for per-account rate limiting — does not expose the raw email. */
function accountKey(identifier: string): string {
  return createHash("sha256").update(identifier.toLowerCase()).digest("hex").slice(0, 24);
}

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  // 10 attempts per minute per IP
  if (!await rateLimit(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";

  // Per-account rate limit: 20 attempts per hour regardless of IP.
  // Applied before the DB lookup so the same limit fires even for non-existent accounts,
  // preventing both brute-force and user enumeration via timing differences.
  if (identifier && !await rateLimit(`login:acct:${accountKey(identifier)}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  const password   = typeof body.password   === "string" ? body.password           : "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: identifier.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    if (user) {
      void writeSecurityEvent({ userId: user.id, type: "login_failed", ip, userAgent: ua,
        metadata: { reason: "no_password" } });
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    void writeSecurityEvent({ userId: user.id, type: "login_failed", ip, userAgent: ua,
      metadata: { reason: "wrong_password" } });
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Suspended check after password verify so this response can't become an oracle.
  if (user.suspendedAt) {
    void writeSecurityEvent({ userId: user.id, type: "login_failed", ip, userAgent: ua,
      metadata: { reason: "suspended" } });
    return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  }

  const device = parseDevice(ua);
  const token  = await createSession(user.id, {
    userAgent:  ua,
    ipHash:     hashIp(ip),
    maskedIp:   maskIp(ip),
    deviceHint: device.hint,
  });
  const session = await db.session.findUnique({ where: { sessionToken: token } });

  if (!session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  void writeSecurityEvent({ userId: user.id, type: "login", ip, userAgent: ua,
    metadata: { device: device.hint } });

  const response = NextResponse.json({
    token,
    expiresAt: session.expires.toISOString(),
    user: mapUser(user, { includeEmail: true }),
  });

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(session.expires));
  return response;
}
