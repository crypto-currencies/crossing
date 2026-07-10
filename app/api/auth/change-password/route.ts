import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended, verifyPassword, hashPassword, createSession } from "@/lib/server/auth";
import { hashIp, maskIp, parseDevice, writeSecurityEvent } from "@/lib/server/security";
import { mapUser } from "@/lib/server/mappers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Suspended accounts cannot rotate credentials (createSession would refuse
  // the re-issued session anyway — fail cleanly here instead).
  if (isSuspended(user)) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }

  // 5 attempts per minute per user+IP
  if (!await rateLimit(`change-password:${clientIp(request)}:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "password_too_long" }, { status: 400 });
  }

  // Fetch full user record (requireAuth returns Prisma User but without passwordHash)
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // OAuth-only users have no password
  if (!dbUser.passwordHash) {
    return NextResponse.json({ error: "no_password" }, { status: 400 });
  }

  if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
    return NextResponse.json({ error: "wrong_current_password" }, { status: 401 });
  }

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), passwordChangedAt: new Date() },
  });

  // Invalidate all existing sessions so other devices are signed out
  await db.session.deleteMany({ where: { userId: user.id } });

  void writeSecurityEvent({ userId: user.id, type: "password_changed", ip, userAgent: ua });

  // Issue a fresh session for the current device so the user stays logged in
  const device   = parseDevice(ua);
  const newToken = await createSession(user.id, { userAgent: ua, ipHash: hashIp(ip), maskedIp: maskIp(ip), deviceHint: device.hint });
  const newSession = await db.session.findUnique({ where: { sessionToken: newToken } });

  // Return the fresh token so the client can update its stored session
  const updatedUser = await db.user.findUnique({ where: { id: user.id } });

  const response = NextResponse.json({
    ok: true,
    token: newToken,
    expiresAt: newSession!.expires.toISOString(),
    user: mapUser(updatedUser!, { includeEmail: true }),
  });

  // Also refresh the httpOnly cookie
  response.cookies.set(SESSION_COOKIE, newToken, sessionCookieOptions(newSession!.expires));

  return response;
}
