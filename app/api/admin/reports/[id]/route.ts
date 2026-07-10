import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { canModifyUser } from "@/lib/server/auth";

// ─── POST /api/admin/reports/[id]/action ─────────────────────────────────────
// Perform a moderation action on a report. Requires ADMIN or OWNER.
//
// Body: { action: string, note?: string, reason?: string }
//
// Supported actions:
//   dismiss   — mark report dismissed, no content change
//   suspend   — set user.suspendedAt + suspendedReason
//   unsuspend — clear user.suspendedAt + suspendedReason

const VALID_ACTIONS = ["dismiss", "suspend", "unsuspend"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: reportId } = await params;

  let body: { action?: unknown; note?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!(VALID_ACTIONS as readonly string[]).includes(body.action as string)) {
    return NextResponse.json(
      { error: "invalid_action", valid: [...VALID_ACTIONS] },
      { status: 400 }
    );
  }
  const action = body.action as Action;
  const note   = typeof body.note === "string"   ? body.note.trim().slice(0, 500)   : undefined;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;

  // ── Load report ────────────────────────────────────────────────────────────
  const report = await db.report.findUnique({
    where:  { id: reportId },
    select: { id: true, targetUserId: true, status: true },
  });
  if (!report) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  }

  // ── Load target user (needed for privilege check) ──────────────────────────
  const target = report.targetUserId
    ? await db.user.findUnique({
        where:  { id: report.targetUserId },
        select: { id: true, role: true, suspendedAt: true },
      })
    : null;

  if (target && !canModifyUser(admin, target)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targetId = target?.id ?? report.targetUserId ?? null;

  // ── Perform action ─────────────────────────────────────────────────────────
  switch (action) {
    case "dismiss":
      // No content modification — just resolve the report
      break;

    case "suspend": {
      if (!targetId) break;
      await db.user.update({
        where: { id: targetId },
        data:  { suspendedAt: new Date(), suspendedReason: reason ?? note ?? null },
      });
      await writeAuditLog({
        adminId:      admin.id,
        action:       "suspend",
        targetUserId: targetId,
        metadata:     { reportId, reason: reason ?? note },
      });
      break;
    }

    case "unsuspend": {
      if (!targetId) break;
      await db.user.update({
        where: { id: targetId },
        data:  { suspendedAt: null, suspendedReason: null },
      });
      await writeAuditLog({
        adminId:      admin.id,
        action:       "unsuspend",
        targetUserId: targetId,
        metadata:     { reportId, note },
      });
      break;
    }
  }

  // ── Mark report resolved/dismissed ────────────────────────────────────────
  const nextStatus = action === "dismiss" ? "dismissed" : "resolved";
  await db.report.update({
    where: { id: reportId },
    data:  {
      status:      nextStatus,
      adminNote:   note ?? null,
      resolvedAt:  new Date(),
      resolvedById: admin.id,
    },
  });

  // Audit log for the report resolution itself
  await writeAuditLog({
    adminId:      admin.id,
    action:       `report.${nextStatus}`,
    targetUserId: targetId ?? undefined,
    metadata:     { reportId, action, note },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
