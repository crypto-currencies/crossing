import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { writeSecurityEvent, generateTotpSecret, buildTotpUri } from "@/lib/server/security";

// ─── POST /api/2fa/totp/setup ─────────────────────────────────────────────────
// Step 1 of TOTP setup: generate a secret, store it as pending, return a real
// scannable otpauth:// QR code (PNG data URL) and the manual key.
//
// The secret is NOT enabled yet. Calling this again replaces any pending secret.
// Call /api/2fa/totp/enable with a valid code to activate.

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(request);
  if (!await rateLimit(`2fa-setup:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const secret = await generateTotpSecret();

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  const label  = dbUser?.email ?? `user-${user.id.slice(0, 8)}`;
  const otpauthUrl = await buildTotpUri(label, secret);

  // Generate QR code as a base64 PNG data URL
  const QRCode = (await import("qrcode")).default;
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 2 });

  // Store as pending — replace any previous pending attempt
  await db.user.update({
    where: { id: user.id },
    data:  { twoFactorPendingSecret: secret },
  });

  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: user.id, type: "totp_setup_started", ip, userAgent: ua });

  // Format the manual key with spaces every 4 chars for readability
  const manualKey = secret.match(/.{1,4}/g)?.join(" ") ?? secret;

  return NextResponse.json({ qrCodeDataUrl, manualKey });
}
