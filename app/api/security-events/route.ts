import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";

// ─── GET /api/security-events ─────────────────────────────────────────────────
// Returns the authenticated user's recent security events.
// Last 50 events from the past 90 days.
// ipHash is never returned — metadata may contain a display-safe masked IP.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const events = await db.securityEvent.findMany({
    where:   { userId: user.id, createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:        true,
      type:      true,
      metadata:  true,
      userAgent: true,
      createdAt: true,
      // ipHash intentionally excluded
    },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      id:        e.id,
      type:      e.type,
      metadata:  e.metadata,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
