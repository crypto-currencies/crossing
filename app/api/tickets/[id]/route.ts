import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";

// ─── GET /api/tickets/[id] ────────────────────────────────────────────────────
// Get a specific ticket. Users can only see their own.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where:   { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id:        true,
          body:      true,
          isAdmin:   true,
          createdAt: true,
          senderId:  true,
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Enforce ownership — admins should use /api/admin/tickets/[id]
  if (ticket.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ ticket });
}
