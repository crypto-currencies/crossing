import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";

// ─── PATCH /api/admin/tickets/[id]/status ────────────────────────────────────
// Update ticket status and/or priority without adding a message. ADMIN+.

const VALID_STATUSES   = ["open","under_review","awaiting_user","resolved","dismissed"] as const;
const VALID_PRIORITIES = ["low","medium","high","urgent"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true, priority: true },
  });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: { status?: unknown; priority?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const newStatus   = typeof body.status   === "string" && (VALID_STATUSES   as readonly string[]).includes(body.status)   ? body.status   : null;
  const newPriority = typeof body.priority === "string" && (VALID_PRIORITIES as readonly string[]).includes(body.priority) ? body.priority : null;

  if (!newStatus && !newPriority)
    return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const isClosing = newStatus === "resolved" || newStatus === "dismissed";

  const updated = await db.supportTicket.update({
    where: { id },
    data: {
      ...(newStatus   ? { status:   newStatus   } : {}),
      ...(newPriority ? { priority: newPriority } : {}),
      updatedAt: new Date(),
      ...(isClosing ? { resolvedAt: new Date(), resolvedById: admin.id } : {}),
    },
  });

  await writeAuditLog({
    adminId:      admin.id,
    action:       "ticket.status_update",
    targetUserId: ticket.userId,
    metadata:     { ticketId: id, prevStatus: ticket.status, newStatus, prevPriority: ticket.priority, newPriority },
  });

  return NextResponse.json({ ticket: updated });
}
