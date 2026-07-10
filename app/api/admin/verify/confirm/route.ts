import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { grantStepUpSession, MAX_ATTEMPTS } from "@/lib/server/step-up";

// ─── POST /api/admin/verify/confirm ──────────────────────────────────────────
// Validates the 6-digit step-up OTP and grants a 10-minute verified session.
//
// Security properties:
//   - Code is hashed before comparison — plaintext never touches the DB
//   - Wrong attempts are tracked; challenge is invalidated after MAX_ATTEMPTS failures
//   - Expired challenges are rejected
//   - Used challenges are rejected (single-use)
//   - Never indicates WHY validation failed beyond "invalid_code" to prevent probing
//
// Body: { code: string }
// Returns: { ok: true, expiresAt: string } | { error: string }

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawCode = typeof body.code === "string" ? body.code.trim().replace(/\D/g, "") : "";
  if (rawCode.length !== 6) {
    return NextResponse.json(
      { error: "invalid_code", message: "Enter the 6-digit code from your email." },
      { status: 400 }
    );
  }

  // ── Find the most recent challenge for this admin ─────────────────────────
  // Looked up regardless of state so we can return a precise reason (expired /
  // used / too-many-attempts / invalid) instead of one conflated error.
  const challenge = await db.adminVerificationChallenge.findFirst({
    where:   { adminId: admin.id },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return NextResponse.json(
      { error: "no_active_challenge", message: "No verification code found. Request a new code." },
      { status: 400 }
    );
  }
  if (challenge.usedAt) {
    return NextResponse.json(
      { error: "code_already_used", message: "This code was already used. Request a new code." },
      { status: 400 }
    );
  }
  if (challenge.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "expired_code", message: "This code has expired. Request a new code." },
      { status: 400 }
    );
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "too_many_attempts", message: "Too many incorrect attempts. Request a new code." },
      { status: 400 }
    );
  }

  const inputHash = hashCode(rawCode);
  const codeMatches = inputHash === challenge.codeHash;

  if (!codeMatches) {
    // Increment attempt counter — invalidate if max reached
    const newAttempts = challenge.attempts + 1;
    await db.adminVerificationChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: newAttempts,
        ...(newAttempts >= MAX_ATTEMPTS ? { usedAt: new Date() } : {}),
      },
    });

    await writeAuditLog({
      adminId:  admin.id,
      action:   "step_up.failed",
      metadata: { attempts: newAttempts, invalidated: newAttempts >= MAX_ATTEMPTS },
    });

    const attemptsLeft = MAX_ATTEMPTS - newAttempts;
    return NextResponse.json(
      {
        error:        "invalid_code",
        message:      attemptsLeft > 0
          ? `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`
          : "Too many incorrect attempts. Request a new code.",
        attemptsLeft: Math.max(0, attemptsLeft),
      },
      { status: 400 }
    );
  }

  // ── Code matches — mark used and grant session ────────────────────────────
  await db.adminVerificationChallenge.update({
    where: { id: challenge.id },
    data:  { usedAt: new Date() },
  });

  const expiresAt = await grantStepUpSession(admin.id);

  await writeAuditLog({
    adminId:  admin.id,
    action:   "step_up.verified",
    metadata: { purpose: challenge.purpose, expiresAt: expiresAt.toISOString() },
  });

  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
}
