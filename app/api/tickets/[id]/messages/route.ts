import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";

// ─── POST /api/tickets/[id]/messages ─────────────────────────────────────────
// User replies to their own ticket. Only allowed when status is not resolved/dismissed.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true },
  });

  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (ticket.status === "resolved" || ticket.status === "dismissed")
    return NextResponse.json({ error: "ticket_closed", status: ticket.status }, { status: 400 });

  let body: { message?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text || text.length < 2)
    return NextResponse.json({ error: "message_too_short" }, { status: 400 });

  const [message] = await db.$transaction([
    db.supportTicketMessage.create({
      data: { ticketId: id, senderId: user.id, body: text.slice(0, 4000), isAdmin: false },
    }),
    // If admin had set awaiting_user, flip back to under_review so they see the reply
    db.supportTicket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        status: ticket.status === "awaiting_user" ? "under_review" : undefined,
      },
    }),
  ]);

  return NextResponse.json({ message }, { status: 201 });
}
