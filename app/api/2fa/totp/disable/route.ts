import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { writeSecurityEvent, verifyTotpOrBackup } from "@/lib/server/security";

// ─── POST /api/2fa/totp/disable ───────────────────────────────────────────────
// Disable TOTP 2FA. Requires the current TOTP code OR a backup code as proof.
// Body: { code: "123456" | "XXXX-XXXX-XXXX" }

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const sessionUser = await requireAuth(request);
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(request);
  if (!await rateLimit(`2fa-disable:${sessionUser.id}`, 5, 60_000)) {
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
    return NextResponse.json({ error: "not_enabled" }, { status: 400 });
  }

  const result = await verifyTotpOrBackup(sessionUser.id, code, user.twoFactorSecret);
  if (!result) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: sessionUser.id },
    data:  {
      twoFactorEnabled:      false,
      twoFactorSecret:       null,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt:    null,
    },
  });

  // Invalidate all backup codes
  await db.userBackupCode.deleteMany({ where: { userId: sessionUser.id } });

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: sessionUser.id, type: "totp_disabled", ip, userAgent: ua,
    metadata: { verifiedWith: result } });

  return NextResponse.json({ ok: true });
}
