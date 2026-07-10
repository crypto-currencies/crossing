import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/tickets ───────────────────────────────────────────────────
// List support tickets with filtering. ADMIN+.
// Query: status, category, priority, q (search subject/userId), page, limit

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url      = new URL(request.url);
  const status   = url.searchParams.get("status")   ?? "";
  const category = url.searchParams.get("category") ?? "";
  const priority = url.searchParams.get("priority") ?? "";
  const q        = url.searchParams.get("q")        ?? "";
  const page     = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1",  10));
  const limit    = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
  const skip     = (page - 1) * limit;

  const validStatuses   = ["open","under_review","awaiting_user","resolved","dismissed"];
  const validCategories = ["account","upload","appeal","bug","other"];
  const validPriorities = ["low","medium","high","urgent"];

  const where: Record<string, unknown> = {};
  if (status   && validStatuses.includes(status))     where.status   = status;
  if (category && validCategories.includes(category)) where.category = category;
  if (priority && validPriorities.includes(priority)) where.priority = priority;
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { userId:  q },
      { id:      q },
    ];
  }

  const [tickets, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, image: true } },
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1,
                    select: { id: true, body: true, isAdmin: true, createdAt: true } },
      },
    }),
    db.supportTicket.count({ where }),
  ]);

  return NextResponse.json({ tickets, total, page, limit });
}
