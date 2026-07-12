import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi, writeAuditLog } from "@/lib/server/admin";
import { canModifyUser } from "@/lib/server/auth";

// ─── PATCH /api/admin/users/[id]/verify ──────────────────────────────────────
// Grant or revoke the verified badge.
// Body: { "verified": boolean }
// Requires OWNER role.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireOwnerApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;

  let body: { verified?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.verified !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (!canModifyUser(admin, target)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await db.user.update({
    where: { id: targetId },
    data:  { verified: body.verified },
  });

  await writeAuditLog({
    adminId:      admin.id,
    action:       body.verified ? "verify.grant" : "verify.revoke",
    targetUserId: targetId,
    metadata:     { prev: target.verified, next: body.verified },
  });

  return NextResponse.json({ ok: true, verified: body.verified });
}
