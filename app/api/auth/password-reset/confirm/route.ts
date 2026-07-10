import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { hashPassword } from "@/lib/server/auth";
import { writeSecurityEvent } from "@/lib/server/security";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

// ─── POST /api/auth/password-reset/confirm ────────────────────────────────────
// Verifies a password-reset token and sets a new password.
// Body: { token: string, email: string, password: string }

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const ip = clientIp(request);
  // 10 attempts per 15 minutes per IP — prevent brute-force on token
  if (!await rateLimit(`pw-reset-confirm:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { token?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token    = typeof body.token    === "string" ? body.token.trim()              : "";
  const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password                  : "";

  if (!token || !email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "password_too_long" }, { status: 400 });
  }

  // Hash the plain token to look up the stored hash
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, email: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.email !== email) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ error: "token_already_used" }, { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  // Fetch user — must have an account and a password column
  const user = await db.user.findUnique({
    where:  { email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const newHash = hashPassword(password);

  // Consume the token and update the password atomically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(async (tx: any) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data:  { passwordHash: newHash, passwordChangedAt: new Date() },
    });
    // Revoke all sessions — a password change means the user should re-authenticate
    await tx.session.deleteMany({ where: { userId: user.id } });
  });

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({
    userId: user.id,
    type: "password_reset_completed",
    ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true });
}
