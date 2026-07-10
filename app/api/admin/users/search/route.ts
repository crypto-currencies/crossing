import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/users/search?q= ──────────────────────────────────────────
// Search users by name, email, or ID prefix.
// Returns full user detail rows (never exposed to non-admins).
// Requires ADMIN or OWNER role.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  if (!raw || raw.length < 2) {
    return NextResponse.json({ error: "query_too_short" }, { status: 400 });
  }

  const q = raw.toLowerCase();

  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name:  { contains: q, mode: "insensitive" } },
        // Exact ID match
        { id: raw },
      ],
    },
    select: {
      id:              true,
      email:           true,
      name:            true,
      role:            true,
      verified:        true,
      createdAt:       true,
      suspendedAt:     true,
      suspendedReason: true,
      _count: {
        select: { accounts: true, sessions: true },
      },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates to ISO strings
  const rows = users.map((u) => ({
    ...u,
    createdAt:   u.createdAt.toISOString(),
    suspendedAt: u.suspendedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ users: rows });
}
