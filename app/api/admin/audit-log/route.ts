import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
// Returns the 50 most recent admin audit log entries.
// Enriches each entry with basic info about the admin and target user.
// Requires ADMIN or OWNER role.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const entries = await db.adminAuditLog.findMany({
    take:    50,
    orderBy: { createdAt: "desc" },
  });

  if (entries.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  // Collect all user IDs we need to resolve
  const userIds = new Set<string>();
  for (const e of entries) {
    userIds.add(e.adminId);
    if (e.targetUserId) userIds.add(e.targetUserId);
  }

  const users = await db.user.findMany({
    where:  { id: { in: Array.from(userIds) } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = entries.map((e) => ({
    id:        e.id,
    action:    e.action,
    metadata:  e.metadata,
    createdAt: e.createdAt.toISOString(),
    admin: (() => {
      const u = userMap.get(e.adminId);
      return u ? { id: u.id, name: u.name } : { id: e.adminId, name: null };
    })(),
    target: e.targetUserId ? (() => {
      const u = userMap.get(e.targetUserId!);
      return u ? { id: u.id, name: u.name } : { id: e.targetUserId, name: null };
    })() : null,
  }));

  return NextResponse.json({ entries: rows });
}
