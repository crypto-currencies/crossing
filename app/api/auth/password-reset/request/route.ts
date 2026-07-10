import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { getBaseUrl } from "@/lib/server/url";
import { emailLayout, emailBodyText, emailCtaButton, emailFallbackUrl } from "@/lib/email-templates";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Email template ───────────────────────────────────────────────────────────

function buildHtml(resetUrl: string): string {
  return emailLayout({
    title: "Reset your password — crossing.dev",
    heading: "Reset your password",
    body: [
      emailBodyText(
        'Click the button below to set a new password for your crossing.dev account. This link expires in <strong style="color:#c4b5fd;">1 hour</strong> and can only be used once.'
      ),
      emailCtaButton("Reset password", resetUrl),
      emailFallbackUrl(resetUrl),
    ].join("\n"),
    footer:
      "If you didn't request this, your account is safe — you can ignore this email. This request came from crossing.dev.",
  });
}

function buildText(resetUrl: string): string {
  return `Reset your crossing.dev password

Click the link below to set a new password. It expires in 1 hour and can only be used once.

${resetUrl}

If you didn't request this, your account is safe — you can ignore this email.`;
}

// ─── POST /api/auth/password-reset/request ────────────────────────────────────
// Initiates password reset. Always returns the same success response regardless
// of whether the email exists — prevents account enumeration.

export async function POST(request: Request) {
  if (!emailConfigured()) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const ip = clientIp(request);
  // 5 requests per 15 minutes per IP — brute-force protection
  if (!await rateLimit(`pw-reset-req:${ip}`, 5, 15 * 60_000)) {
    // Still return ok — leaking rate-limit status would help enumeration
    return NextResponse.json({ ok: true });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Look up the account — if it doesn't exist, respond identically to success
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // No account or OAuth-only account → respond identically (no enumeration)
  if (!user || !user.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  // Purge any existing unused tokens for this email (one active token at a time)
  await db.passwordResetToken.deleteMany({ where: { email, usedAt: null } }).catch(() => {});

  // Generate token — URL-safe plain text, stored as SHA-256 hash
  const plain = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(plain).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.passwordResetToken.create({ data: { email, tokenHash, expiresAt } });

  const resetUrl = `${getBaseUrl()}/reset-password?token=${plain}&email=${encodeURIComponent(email)}`;

  try {
    await sendEmail({
      to: email,
      subject: "Reset your crossing.dev password",
      html: buildHtml(resetUrl),
      text: buildText(resetUrl),
    });
  } catch (err) {
    console.error("[password-reset] Send failed:", err);
    await db.passwordResetToken.deleteMany({ where: { tokenHash } }).catch(() => {});
    // Still return ok — don't leak whether the email exists
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
