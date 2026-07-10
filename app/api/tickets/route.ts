import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";

const VALID_CATEGORIES = [
  "account",
  "profile",
  "upload",
  "integrations",
  "appeal",
  "bug",
  "other",
] as const;

// ─── GET /api/tickets ─────────────────────────────────────────────────────────
// List the authenticated user's own support tickets.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tickets = await db.supportTicket.findMany({
    where:   { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take:    50,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take:    1,
        select:  { id: true, body: true, isAdmin: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ tickets });
}

// ─── POST /api/tickets ────────────────────────────────────────────────────────
// Create a new support ticket. Rate-limit: 5 open tickets max.

export async function POST(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { category?: unknown; subject?: unknown; description?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const category    = typeof body.category    === "string" ? body.category.trim()    : "";
  const subject     = typeof body.subject     === "string" ? body.subject.trim()     : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!(VALID_CATEGORIES as readonly string[]).includes(category))
    return NextResponse.json({ error: "invalid_category", valid: [...VALID_CATEGORIES] }, { status: 400 });
  if (!subject || subject.length < 5)
    return NextResponse.json({ error: "subject_too_short" }, { status: 400 });
  if (subject.length > 120)
    return NextResponse.json({ error: "subject_too_long" }, { status: 400 });
  if (!description || description.length < 10)
    return NextResponse.json({ error: "description_too_short" }, { status: 400 });

  // Rate-limit: max 5 open/under_review tickets
  const openCount = await db.supportTicket.count({
    where: { userId: user.id, status: { in: ["open", "under_review", "awaiting_user"] } },
  });
  if (openCount >= 5)
    return NextResponse.json({ error: "too_many_open_tickets", max: 5 }, { status: 429 });

  const ticket = await db.supportTicket.create({
    data: {
      userId:   user.id,
      category,
      subject:  subject.slice(0, 120),
      status:   "open",
      priority: "low",
      messages: {
        create: {
          senderId: user.id,
          body:     description.slice(0, 4000),
          isAdmin:  false,
        },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
