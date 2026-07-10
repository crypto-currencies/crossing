import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";

// ─── POST /api/admin/tickets/[id]/messages ────────────────────────────────────
// Admin replies to a support ticket. ADMIN+.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.status === "resolved" || ticket.status === "dismissed")
    return NextResponse.json({ error: "ticket_closed" }, { status: 400 });

  let body: { message?: unknown; setStatus?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const text      = typeof body.message   === "string" ? body.message.trim()   : "";
  const setStatus = typeof body.setStatus === "string" ? body.setStatus.trim() : "";

  if (!text || text.length < 2)
    return NextResponse.json({ error: "message_too_short" }, { status: 400 });

  const validStatuses = ["open","under_review","awaiting_user","resolved","dismissed"];
  const nextStatus = validStatuses.includes(setStatus) ? setStatus : "awaiting_user";

  const [message] = await db.$transaction([
    db.supportTicketMessage.create({
      data: { ticketId: id, senderId: admin.id, body: text.slice(0, 4000), isAdmin: true },
    }),
    db.supportTicket.update({
      where: { id },
      data: {
        status:      nextStatus,
        updatedAt:   new Date(),
        resolvedAt:  ["resolved","dismissed"].includes(nextStatus) ? new Date() : undefined,
        resolvedById: ["resolved","dismissed"].includes(nextStatus) ? admin.id  : undefined,
      },
    }),
  ]);

  await writeAuditLog({
    adminId:      admin.id,
    action:       "ticket.reply",
    targetUserId: ticket.userId,
    metadata:     { ticketId: id, setStatus: nextStatus },
  });

  return NextResponse.json({ message }, { status: 201 });
}
