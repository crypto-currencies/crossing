import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { getBaseUrl } from "@/lib/server/url";
import { writeSecurityEvent } from "@/lib/server/security";
import { emailLayout, emailBodyText, emailCtaButton, emailFallbackUrl } from "@/lib/email-templates";

const TOKEN_TTL_MS    = 24 * 60 * 60 * 1000; // 24 hours
const IDENTIFIER_PREFIX = "email-verify:";

// ─── Email template ───────────────────────────────────────────────────────────

function buildHtml(verifyUrl: string, email: string): string {
  return emailLayout({
    title: "Verify your email — crossing.dev",
    heading: "Verify your email address",
    body: [
      emailBodyText(
        `You're setting up your crossing.dev account with <strong style="color:#c4b5fd;">${email}</strong>. Click the button below to verify this address. This link expires in <strong style="color:#c4b5fd;">24 hours</strong>.`
      ),
      emailCtaButton("Verify email address", verifyUrl),
      emailFallbackUrl(verifyUrl),
    ].join("\n"),
    footer: "If you didn't create an account on crossing.dev, you can safely ignore this email.",
  });
}

function buildText(verifyUrl: string): string {
  return `Verify your crossing.dev email address

Click the link below to verify your email. It expires in 24 hours.

${verifyUrl}

If you didn't create an account, you can safely ignore this email.`;
}

// ─── Shared helper — send or resend a verification email ─────────────────────

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const identifier = `${IDENTIFIER_PREFIX}${userId}`;

  // Purge any existing unused token for this user
  await db.verificationToken.deleteMany({ where: { identifier } }).catch(() => {});

  const token   = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await db.verificationToken.create({ data: { identifier, token, expires } });

  const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${token}&userId=${encodeURIComponent(userId)}`;

  await sendEmail({
    to: email,
    subject: "Verify your email address — crossing.dev",
    html: buildHtml(verifyUrl, email),
    text: buildText(verifyUrl),
  });
}

// ─── POST /api/auth/verify-email/resend ───────────────────────────────────────

export async function POST(request: Request) {
  if (!emailConfigured()) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "account_suspended" }, { status: 403 });

  // 3 resends per hour per user
  if (!await rateLimit(`verify-email-resend:${user.id}:${clientIp(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const dbUser = await db.user.findUnique({
    where:  { id: user.id },
    select: { email: true, emailVerifiedAt: true },
  });

  if (!dbUser?.email) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }
  if (dbUser.emailVerifiedAt) {
    return NextResponse.json({ error: "already_verified" }, { status: 400 });
  }

  try {
    await sendVerificationEmail(user.id, dbUser.email);
    void writeSecurityEvent({ userId: user.id, type: "email_verification_sent" });
  } catch (err) {
    console.error("[verify-email] Send failed:", err);
    return NextResponse.json({ error: "email_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
