import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
// Returns platform-wide aggregate stats. Requires ADMIN or OWNER role.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now          = Date.now();
  const oneDayAgo    = new Date(now - 1  * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7  * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo= new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    signups24h,
    signups7d,
    signups30d,
    suspendedUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { verified: true  } }),
    db.user.count({ where: { verified: false } }),
    db.user.count({ where: { createdAt: { gte: oneDayAgo     } } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo  } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { suspendedAt: { not: null } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    signups24h,
    signups7d,
    signups30d,
    suspendedUsers,
  });
}
