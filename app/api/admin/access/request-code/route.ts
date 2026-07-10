import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi, writeAuditLog, OWNER_EMAIL } from "@/lib/server/admin";
import { isOwner } from "@/lib/server/auth";
import { sendEmail, emailConfigured } from "@/lib/email";
import { emailLayout, emailBodyText, emailOtpBlock } from "@/lib/email-templates";

// ─── POST /api/admin/access/request-code ─────────────────────────────────────
// Generates a 6-digit OTP for a role change and emails it to the owner.
// OWNER only. The code expires in 10 minutes and is single-use.
//
// Body: { targetUserId, targetRole, action }
//   targetRole: "ADMIN" | "MODERATOR" | "USER"
//   action:     "grant" | "revoke"

const VALID_ROLES   = ["ADMIN", "MODERATOR", "USER"] as const;
const VALID_ACTIONS = ["grant", "revoke"] as const;
const CODE_TTL_MS   = 10 * 60 * 1000; // 10 minutes

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const owner = await requireOwnerApi(request);
  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { targetUserId?: unknown; targetRole?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  const targetRole   = typeof body.targetRole  === "string" ? body.targetRole.trim().toUpperCase() : "";
  const action       = typeof body.action      === "string" ? body.action.trim().toLowerCase() : "";

  if (!targetUserId) {
    return NextResponse.json({ error: "missing_targetUserId" }, { status: 400 });
  }
  if (!(VALID_ROLES as readonly string[]).includes(targetRole)) {
    return NextResponse.json({ error: "invalid_role", valid: [...VALID_ROLES] }, { status: 400 });
  }
  if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "invalid_action", valid: [...VALID_ACTIONS] }, { status: 400 });
  }

  // ── Verify target exists ─────────────────────────────────────────────────
  const target = await db.user.findUnique({
    where:  { id: targetUserId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // ── Safety constraints ───────────────────────────────────────────────────

  // Cannot target the owner's own account through the access panel
  if (target.id === owner.id) {
    return NextResponse.json({ error: "cannot_modify_self" }, { status: 400 });
  }

  // Cannot touch another OWNER account
  if (isOwner(target)) {
    return NextResponse.json({ error: "cannot_modify_owner" }, { status: 403 });
  }

  // Cannot "grant" the same role they already have
  if (action === "grant" && target.role === targetRole) {
    return NextResponse.json({ error: "already_has_role" }, { status: 400 });
  }

  // Cannot grant OWNER through this mechanism — OWNER is bootstrap-only
  if (targetRole === "OWNER") {
    return NextResponse.json({ error: "cannot_grant_owner" }, { status: 403 });
  }

  // ── Invalidate any prior unused codes for this target ────────────────────
  await db.roleGrantCode.updateMany({
    where: {
      ownerId:      owner.id,
      targetUserId: targetUserId,
      used:         false,
    },
    data: { used: true },
  });

  // Email delivery is the only channel for role-grant codes. Without it, refuse
  // to generate a code at all — codes are never logged or returned in responses.
  if (!emailConfigured()) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  // ── Generate OTP ──────────────────────────────────────────────────────────
  const code     = randomInt(100000, 999999).toString();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.roleGrantCode.create({
    data: {
      codeHash,
      ownerId:      owner.id,
      targetUserId: targetUserId,
      targetRole,
      action,
      expiresAt,
    },
  });

  // ── Send email ────────────────────────────────────────────────────────────
  const actionLabel  = action === "grant" ? `Grant ${targetRole}` : `Revoke role from`;
  const targetHandle = target.name ?? target.id;

  await sendEmail({
      to:      OWNER_EMAIL,
      subject: `Crossing.dev — Role change verification code`,
      text: [
        `Role change requested: ${actionLabel} for ${targetHandle}`,
        ``,
        `Your verification code: ${code}`,
        ``,
        `This code expires in 10 minutes and can only be used once.`,
        `If you did not request this, someone may have compromised your admin session.`,
      ].join("\n"),
      html: emailLayout({
        title: "Crossing.dev — Role change verification code",
        heading: "Role change verification",
        body: [
          emailBodyText(
            `Confirm the following action: <strong style="color:#c4b5fd;">${actionLabel}</strong> for <strong style="color:#c4b5fd;">${targetHandle}</strong>. Enter the code below to proceed.`
          ),
          emailOtpBlock(code),
        ].join("\n"),
        footer:
          "If you did not request this, your admin session may be compromised — take action immediately.",
      }),
  });

  await writeAuditLog({
    adminId:      owner.id,
    action:       "role.code_requested",
    targetUserId: targetUserId,
    metadata:     { targetRole, action },
  });

  return NextResponse.json({ ok: true });
}
