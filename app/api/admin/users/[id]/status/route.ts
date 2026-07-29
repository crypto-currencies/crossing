import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi, writeAuditLog } from "@/lib/server/admin";
import { canModifyUser, revokeAllSessions } from "@/lib/server/auth";

// ─── PATCH /api/admin/users/[id]/status ──────────────────────────────────────
// Suspend or unsuspend a user account.
// Body: { "suspended": boolean, "reason"?: string }
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

  let body: { suspended?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.suspended !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const reason =
    body.suspended && typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : null;

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (!canModifyUser(admin, target)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Suspension and session revocation happen ATOMICALLY (SEC-002). Splitting
  // them would leave a window where the account reads as suspended while its
  // sessions still authenticate — exactly the gap this fixes.
  //
  // Unsuspending deliberately does NOT restore the revoked sessions: they are
  // gone, so the user must sign in again to obtain a fresh one.
  let revokedSessions = 0;
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetId },
      data: body.suspended
        ? { suspendedAt: new Date(), suspendedReason: reason }
        : { suspendedAt: null,      suspendedReason: null },
    });

    if (body.suspended) {
      revokedSessions = await revokeAllSessions(targetId, tx);
    }
  });

  await writeAuditLog({
    adminId:      admin.id,
    action:       body.suspended ? "suspend" : "unsuspend",
    targetUserId: targetId,
    metadata:     { reason, revokedSessions },
  });

  return NextResponse.json({ ok: true, suspended: body.suspended, revokedSessions });
}
