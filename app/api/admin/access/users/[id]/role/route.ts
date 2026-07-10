import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi, writeAuditLog } from "@/lib/server/admin";
import { isOwner } from "@/lib/server/auth";
import { getRoleChangePhrase, normalizePhrase, type RoleChangeAction, type RoleChangeRole } from "@/lib/admin-access";

// ─── PATCH /api/admin/access/users/[id]/role ─────────────────────────────────
// Apply a role change after OTP verification. OWNER only.
//
// Body: { role, action, code, confirmPhrase }
//   role:          "ADMIN" | "MODERATOR" | "USER"
//   action:        "grant" | "revoke"
//   code:          6-digit OTP from email
//   confirmPhrase: e.g. "GRANT ADMIN TO @username"

const VALID_ROLES   = ["ADMIN", "MODERATOR", "USER"] as const;
const VALID_ACTIONS = ["grant", "revoke"] as const;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const owner = await requireOwnerApi(request);
  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;

  let body: { role?: unknown; action?: unknown; code?: unknown; confirmPhrase?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role          = typeof body.role          === "string" ? body.role.trim().toUpperCase()  : "";
  const action        = typeof body.action        === "string" ? body.action.trim().toLowerCase() : "";
  const code          = typeof body.code          === "string" ? body.code.trim()                 : "";
  // Keep confirmPhrase as-is; normalizePhrase() handles trim + case for comparison.
  const confirmPhrase = typeof body.confirmPhrase === "string" ? body.confirmPhrase               : "";

  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "invalid_role", valid: [...VALID_ROLES] }, { status: 400 });
  }
  if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });
  }

  // ── Load and validate target ──────────────────────────────────────────────
  const target = await db.user.findUnique({
    where:  { id: targetId },
    select: { id: true, role: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Hard safety guards
  if (target.id === owner.id) {
    return NextResponse.json({ error: "cannot_modify_self" }, { status: 400 });
  }
  if (isOwner(target)) {
    return NextResponse.json({ error: "cannot_modify_owner" }, { status: 403 });
  }
  if (role === "OWNER") {
    return NextResponse.json({ error: "cannot_grant_owner" }, { status: 403 });
  }

  // ── Validate confirmation phrase ──────────────────────────────────────────
  const expected = getRoleChangePhrase(action as RoleChangeAction, role as RoleChangeRole, target.name);
  if (normalizePhrase(confirmPhrase) !== normalizePhrase(expected)) {
    return NextResponse.json(
      { error: "wrong_phrase", expected },
      { status: 400 }
    );
  }

  // ── Validate and consume OTP ──────────────────────────────────────────────
  // Look the code up by its hash + scope WITHOUT the used/expiry filters first,
  // so we can return a precise reason (invalid vs expired vs already-used)
  // rather than a single conflated error. The code itself is never logged.
  const otpRecord = await db.roleGrantCode.findFirst({
    where: {
      codeHash:     hashCode(code),
      ownerId:      owner.id,
      targetUserId: targetId,
      targetRole:   role,
      action:       action,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    // No code with this hash for this exact change — wrong digits.
    return NextResponse.json(
      { error: "invalid_code", message: "Incorrect code. Check the digits and try again." },
      { status: 400 }
    );
  }
  if (otpRecord.used) {
    return NextResponse.json(
      { error: "code_already_used", message: "This code was already used. Request a new one." },
      { status: 400 }
    );
  }
  if (otpRecord.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "expired_code", message: "This code has expired. Request a new one." },
      { status: 400 }
    );
  }

  // Mark OTP used (do this before applying the change — atomic-ish)
  await db.roleGrantCode.update({
    where: { id: otpRecord.id },
    data:  { used: true },
  });

  // ── Apply role change ─────────────────────────────────────────────────────
  const previousRole = target.role as string;

  await db.user.update({
    where: { id: targetId },
    data: {
      role:           role as "USER" | "MODERATOR" | "ADMIN",
      roleChangedAt:  new Date(),
      roleGrantedById: owner.id,
    },
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  const auditAction = action === "grant" ? "role.grant" : "role.revoke";
  await writeAuditLog({
    adminId:      owner.id,
    action:       auditAction,
    targetUserId: targetId,
    metadata: {
      previousRole,
      newRole:      role,
      action,
      targetName: target.name,
    },
  });

  return NextResponse.json({
    ok:           true,
    previousRole,
    newRole:      role,
    targetUserId: targetId,
  });
}
