import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { writeSecurityEvent, verifyTotpOrBackup, replaceBackupCodes } from "@/lib/server/security";

// ─── GET /api/2fa/backup-codes ────────────────────────────────────────────────
// Returns the count of remaining (unused) backup codes. Never returns the codes.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const remaining = await db.userBackupCode.count({ where: { userId: user.id, usedAt: null } });
  const total     = await db.userBackupCode.count({ where: { userId: user.id } });
  return NextResponse.json({ remaining, total });
}

// ─── POST /api/2fa/backup-codes ───────────────────────────────────────────────
// Regenerate backup codes. Invalidates all old codes.
// Requires TOTP code or an existing backup code for verification.
// Body: { code: "123456" | "XXXX-XXXX-XXXX" }

export async function POST(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const sessionUser = await requireAuth(request);
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(request);
  if (!await rateLimit(`backup-codes-regen:${sessionUser.id}`, 3, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { code?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });

  const user = await db.user.findUnique({
    where:  { id: sessionUser.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2fa_not_enabled" }, { status: 400 });
  }

  const result = await verifyTotpOrBackup(sessionUser.id, code, user.twoFactorSecret);
  if (!result) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const backupCodes = await replaceBackupCodes(sessionUser.id);

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: sessionUser.id, type: "backup_codes_generated", ip, userAgent: ua,
    metadata: { regenerated: true, count: backupCodes.length } });

  return NextResponse.json({ ok: true, backupCodes });
}
