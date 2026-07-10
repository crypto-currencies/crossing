import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/tickets/[id] ─────────────────────────────────────────────
// Full ticket detail with all messages. ADMIN+.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, role: true,
          suspendedAt: true, image: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, role: true, image: true } },
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ticket });
}
