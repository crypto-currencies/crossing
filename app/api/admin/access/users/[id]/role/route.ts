import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi, writeAuditLog } from "@/lib/server/admin";
import { isOwner } from "@/lib/server/auth";

// ─── PATCH /api/admin/access/users/[id]/role ─────────────────────────────────
// Grant or revoke a role. OWNER only.
//
// Body: { role, action }
//   role:   "ADMIN" | "MODERATOR" | "USER"
//   action: "grant" | "revoke"

const VALID_ROLES   = ["ADMIN", "MODERATOR", "USER"] as const;
const VALID_ACTIONS = ["grant", "revoke"] as const;

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

  let body: { role?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role   = typeof body.role   === "string" ? body.role.trim().toUpperCase()  : "";
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "invalid_role", valid: [...VALID_ROLES] }, { status: 400 });
  }
  if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
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
      newRole: role,
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
