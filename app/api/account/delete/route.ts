import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, verifyPassword } from "@/lib/server/auth";
import { writeSecurityEvent } from "@/lib/server/security";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

// ─── POST /api/account/delete ─────────────────────────────────────────────────
// Immediately and permanently deletes the authenticated user's account.
// Cascade deletes remove all related rows (sessions, notifications, etc.).
//
// Body: { confirmation: "DELETE", password?: string }
//
// Verification rules:
//   - Accounts with a password → password required
//   - OAuth-only accounts (no password) → confirmation string is sufficient

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = clientIp(request);
  // 5 attempts per 15 minutes — prevent brute-force on the password check
  if (!await rateLimit(`account-delete:${user.id}:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { confirmation?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Typed confirmation is always required
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, passwordHash: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Owners cannot delete their own account to prevent loss of the platform
  if (dbUser.role === "OWNER") {
    return NextResponse.json({ error: "owner_cannot_delete", message: "Transfer ownership before deleting your account." }, { status: 403 });
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

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({
    userId: user.id,
    type:   "account_deleted",
    ip,
    userAgent: ua,
  });

  // Hard-delete — Prisma cascade removes all related rows.
  await db.user.delete({ where: { id: user.id } });

  return NextResponse.json({ ok: true });
}
