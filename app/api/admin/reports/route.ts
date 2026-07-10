import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
// List user reports. Requires ADMIN or OWNER role.
// Query params: status=pending|resolved|dismissed|all (default: pending), page, limit

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url    = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit  = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip   = (page - 1) * limit;

  const validStatuses = ["pending", "resolved", "dismissed", "all"];
  const whereStatus =
    validStatuses.includes(status) && status !== "all" ? { status } : {};

  const [reports, total] = await Promise.all([
    db.report.findMany({
      where:   whereStatus,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id:           true,
        reason:       true,
        details:      true,
        status:       true,
        adminNote:    true,
        resolvedAt:   true,
        resolvedById: true,
        createdAt:    true,
        targetUserId: true,
        reporterId:   true,
      },
    }),
    db.report.count({ where: whereStatus }),
  ]);

  // Look up user info for targets and reporters in one query
  const userIds = [
    ...new Set([
      ...reports.map((r) => r.targetUserId).filter(Boolean) as string[],
      ...reports.map((r) => r.reporterId),
    ]),
  ];

  const users = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: {
      id:          true,
      name:        true,
      role:        true,
      suspendedAt: true,
      image:       true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = reports.map((r) => {
    const target   = r.targetUserId ? userMap.get(r.targetUserId) : null;
    const reporter = userMap.get(r.reporterId);
    return {
      id:           r.id,
      reason:       r.reason,
      details:      r.details,
      status:       r.status,
      adminNote:    r.adminNote,
      resolvedAt:   r.resolvedAt,
      resolvedById: r.resolvedById,
      createdAt:    r.createdAt,
      target: target
        ? {
            id:        target.id,
            name:      target.name,
            role:      target.role,
            suspended: !!target.suspendedAt,
            avatarUrl: target.image ?? null,
          }
        : null,
      // Reporter info only shown to admins — never exposed publicly
      reporter: reporter
        ? { id: reporter.id, name: reporter.name }
        : null,
    };
  });

  return NextResponse.json({ reports: enriched, total, page, limit });
}

// ─── POST /api/admin/reports ──────────────────────────────────────────────────
// Admin-submitted report against a user.
export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { requireAuth } = await import("@/lib/server/auth");
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { targetUserId?: unknown; reason?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  const reason       = typeof body.reason === "string"       ? body.reason.trim()       : "";
  const details      = typeof body.details === "string"       ? body.details.trim()      : "";

  if (!targetUserId) return NextResponse.json({ error: "missing_targetUserId" }, { status: 400 });
  if (!reason)       return NextResponse.json({ error: "missing_reason" },       { status: 400 });

  const report = await db.report.create({
    data: { reporterId: user.id, targetUserId, reason, details },
  });

  return NextResponse.json({ id: report.id }, { status: 201 });
}
