import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { emailLayout, emailBodyText, emailOtpBlock } from "@/lib/email-templates";
import {
  CHALLENGE_TTL_MS,
  RATE_LIMIT_COUNT,
  RATE_LIMIT_MS,
} from "@/lib/server/step-up";

// ─── POST /api/admin/verify/request ──────────────────────────────────────────
// Sends a 6-digit step-up OTP to the admin's email address.
// The code is SHA-256 hashed before storage — never logged, never returned.
//
// Rate limit: max 3 requests per 15-minute window per admin.
// Old unused challenges for the same admin are invalidated on new request.
//
// Body: { purpose?: string }  — optional label for audit log (default "step_up")

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2 ? "***" : `${local[0]}***${local[local.length - 1]}`;
  return `${masked}@${domain}`;
}

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!admin.email) {
    return NextResponse.json(
      { error: "admin_no_email", message: "Your admin account has no email address on file." },
      { status: 400 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { purpose?: unknown } = {};
  try { body = await request.json(); } catch { /* no body is fine */ }
  const purpose = typeof body.purpose === "string" ? body.purpose.slice(0, 64) : "step_up";

  // ── Rate limit: max RATE_LIMIT_COUNT challenges in last RATE_LIMIT_MS ms ──
  const since = new Date(Date.now() - RATE_LIMIT_MS);
  const recentCount = await db.adminVerificationChallenge.count({
    where: {
      adminId:   admin.id,
      createdAt: { gte: since },
    },
  });
  if (recentCount >= RATE_LIMIT_COUNT) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many verification requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  // ── Invalidate all prior unused, unexpired challenges for this admin ───────
  await db.adminVerificationChallenge.updateMany({
    where: {
      adminId:  admin.id,
      usedAt:   null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  // Email delivery is the only channel for step-up codes. Without it, refuse
  // to generate a code at all — codes are never logged or returned in responses.
  if (!emailConfigured()) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  // ── Generate OTP ──────────────────────────────────────────────────────────
  // IMPORTANT: `code` is only used here and in the email — it is NEVER stored
  // in plaintext and NEVER returned in any API response.
  const code      = randomInt(100_000, 999_999).toString();
  const codeHash  = hashCode(code);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db.adminVerificationChallenge.create({
    data: { adminId: admin.id, codeHash, purpose, expiresAt },
  });

  // ── Send email ────────────────────────────────────────────────────────────
  const displayName = admin.name ?? "Admin";
  const maskedEmail = maskEmail(admin.email);

  await sendEmail({
      to:      admin.email,
      subject: "Crossing.dev — Admin verification code",
      text: [
        `Hi ${displayName},`,
        ``,
        `A sensitive admin action requires identity verification.`,
        ``,
        `Your one-time verification code: ${code}`,
        ``,
        `This code expires in 10 minutes and can only be used once.`,
        `If you did not trigger this, your admin session may be compromised.`,
        `Contact the platform owner immediately.`,
      ].join("\n"),
      html: emailLayout({
        title: "Crossing.dev — Admin verification code",
        heading: "Verify your identity",
        body: [
          emailBodyText(
            `Hi ${displayName}, a sensitive admin action requires step-up verification. Enter the code below to proceed.`
          ),
          emailOtpBlock(code),
        ].join("\n"),
        footer:
          "If you did not request this, your session may be compromised — contact the platform owner immediately.",
      }),
  });

  // ── Audit ─────────────────────────────────────────────────────────────────
  await writeAuditLog({
    adminId: admin.id,
    action:  "step_up.requested",
    metadata: { purpose },
  });

  // Return masked email so UI can show "code sent to e***@gmail.com"
  return NextResponse.json({ ok: true, maskedEmail });
}
