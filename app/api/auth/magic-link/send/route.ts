import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { randomBytes, createHash } from "crypto";
import { getBaseUrl } from "@/lib/server/url";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { emailConfigured, sendEmail } from "@/lib/email";
import { emailLayout, emailBodyText, emailCtaButton, emailFallbackUrl } from "@/lib/email-templates";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Email templates ──────────────────────────────────────────────────────────

function buildHtml(verifyUrl: string): string {
  return emailLayout({
    title: "Sign in to crossing.dev",
    heading: "Your sign-in link",
    body: [
      emailBodyText(
        'Click the button below to sign in to your account. This link expires in <strong style="color:#c4b5fd;">15 minutes</strong> and can only be used once.'
      ),
      emailCtaButton("Sign in to crossing.dev", verifyUrl),
      emailFallbackUrl(verifyUrl),
    ].join("\n"),
    footer:
      "If you didn't request this, you can safely ignore this email. This link was sent from crossing.dev.",
  });
}

function buildText(verifyUrl: string): string {
  return `Sign in to crossing.dev

Click the link below to sign in. It expires in 15 minutes and can only be used once.

${verifyUrl}

If you didn't request this, you can safely ignore this email.`;
}

// ─── POST /api/auth/magic-link/send ───────────────────────────────────────────

export async function POST(request: Request) {
  // Guard: Resend must be configured (RESEND_API_KEY + EMAIL_FROM)
  if (!emailConfigured()) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // 5 magic link requests per minute per IP
  if (!await rateLimit(`magic-link:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
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

  // Purge any existing tokens for this address (one active link at a time)
  await db.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => {});

  // Generate plain token for the URL; store only the SHA-256 hash so a DB
  // read-level compromise cannot be used to immediately sign in as anyone.
  const plain     = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(plain).digest("hex");
  const expires   = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await db.verificationToken.create({
    data: { identifier: email, token: tokenHash, expires },
  });

  // Build the verification URL using the canonical site URL (production-safe)
  const verifyUrl = `${getBaseUrl()}/api/auth/magic-link/verify?token=${plain}&email=${encodeURIComponent(email)}`;

  // ── Send via Resend ────────────────────────────────────────────────────────
  try {
    await sendEmail({
      to: email,
      subject: "Sign in to crossing.dev",
      html: buildHtml(verifyUrl),
      text: buildText(verifyUrl),
    });
  } catch (err) {
    console.error("[magic-link] Resend send failed:", err);
    // Clean up the token we just created — it won't be usable
    await db.verificationToken
      .delete({ where: { identifier_token: { identifier: email, token: tokenHash } } })
      .catch(() => {});
    return NextResponse.json({ error: "email_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
