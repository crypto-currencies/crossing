import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { writeSecurityEvent, replaceBackupCodes } from "@/lib/server/security";

// ─── POST /api/2fa/totp/enable ────────────────────────────────────────────────
// Step 2 of TOTP setup: verify the code from the authenticator app, then:
//   - Move pendingSecret → twoFactorSecret
//   - Set twoFactorEnabled = true
//   - Generate backup codes (shown ONCE in the response)
//   - Write SecurityEvent
//
// Body: { code: "123456" }

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const sessionUser = await requireAuth(request);
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(request);
  if (!await rateLimit(`2fa-enable:${sessionUser.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { code?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where:  { id: sessionUser.id },
    select: { twoFactorPendingSecret: true, twoFactorEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "already_enabled" }, { status: 400 });
  }
  if (!user.twoFactorPendingSecret) {
    return NextResponse.json({ error: "no_pending_setup", message: "Call /api/2fa/totp/setup first." }, { status: 400 });
  }

  const { verifyTotp } = await import("@/lib/server/security");
  const valid = await verifyTotp(code, user.twoFactorPendingSecret);
  if (!valid) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // Activate 2FA and clear pending secret
  await db.user.update({
    where: { id: sessionUser.id },
    data:  {
      twoFactorEnabled:      true,
      twoFactorSecret:       user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt:    new Date(),
    },
  });

  // Generate and store backup codes — returned ONCE to the client
  const backupCodes = await replaceBackupCodes(sessionUser.id);

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: sessionUser.id, type: "totp_enabled", ip, userAgent: ua });
  void writeSecurityEvent({ userId: sessionUser.id, type: "backup_codes_generated", ip, userAgent: ua,
    metadata: { count: backupCodes.length } });

  return NextResponse.json({ ok: true, backupCodes });
}
