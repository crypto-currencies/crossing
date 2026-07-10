import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended, hashPassword, createSession } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { hashIp, maskIp, parseDevice, writeSecurityEvent } from "@/lib/server/security";

// ─── POST /api/auth/set-password ─────────────────────────────────────────────
// For OAuth-only accounts that have no password yet.
// Does NOT require a current password (there is none).
// Requires an active session (proves account ownership).

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Suspended accounts cannot set credentials (createSession would refuse
  // the re-issued session anyway — fail cleanly here instead).
  if (isSuspended(user)) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }

  // 5 set-password attempts per minute per user+IP
  const ip = clientIp(request);
  if (!await rateLimit(`set-password:${ip}:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  // Fetch fresh user to check current password state
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // This endpoint is only for accounts WITHOUT a password
  if (dbUser.passwordHash) {
    return NextResponse.json({ error: "password_already_set", message: "Use change-password instead." }, { status: 400 });
  }

  let body: { newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8)  return NextResponse.json({ error: "password_too_short"  }, { status: 400 });
  if (newPassword.length > 128) return NextResponse.json({ error: "password_too_long"  }, { status: 400 });

  const ua = request.headers.get("user-agent") ?? undefined;

  await db.user.update({
    where: { id: user.id },
    data:  { passwordHash: hashPassword(newPassword), passwordChangedAt: new Date() },
  });

  // Rotate session (keeps current device logged in, same as change-password)
  await db.session.deleteMany({ where: { userId: user.id } });
  const device   = parseDevice(ua);
  const newToken = await createSession(user.id, { userAgent: ua, ipHash: hashIp(ip), maskedIp: maskIp(ip), deviceHint: device.hint });
  const newSess  = await db.session.findUnique({ where: { sessionToken: newToken } });

  void writeSecurityEvent({ userId: user.id, type: "password_set", ip, userAgent: ua });

  const updatedUser = await db.user.findUnique({ where: { id: user.id } });

  const res = NextResponse.json({
    ok:        true,
    token:     newToken,
    expiresAt: newSess!.expires.toISOString(),
    user:      mapUser(updatedUser!, { includeEmail: true }),
  });
  res.cookies.set(SESSION_COOKIE, newToken, sessionCookieOptions(newSess!.expires));
  return res;
}
