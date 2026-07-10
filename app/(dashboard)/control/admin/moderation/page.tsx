import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/server/admin";
import { isAdmin } from "@/lib/server/auth";
import { db, DB_AVAILABLE } from "@/lib/db";
import { PageTransition } from "@/components/motion/page-transition";
import { ModerationClient } from "@/components/admin/moderation-client";

export const metadata: Metadata = { title: "Moderation — Admin", robots: "noindex, nofollow" };

async function getReports(status: string) {
  if (!DB_AVAILABLE) return { reports: [], total: 0 };
  try {
    const whereStatus = status === "all" ? {} : { status };

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where:   whereStatus,
        orderBy: { createdAt: "desc" },
        take:    50,
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
        adminNote:    r.adminNote ?? null,
        resolvedAt:   r.resolvedAt?.toISOString() ?? null,
        resolvedById: r.resolvedById ?? null,
        createdAt:    r.createdAt.toISOString(),
        target: target
          ? {
              id:        target.id,
              name:      target.name ?? null,
              role:      target.role as string,
              suspended: !!target.suspendedAt,
              avatarUrl: target.image ?? null,
            }
          : null,
        reporter: reporter
          ? { id: reporter.id, name: reporter.name ?? null }
          : null,
      };
    });

    return { reports: enriched, total };
  } catch {
    return { reports: [], total: 0 };
  }
}

async function getCounts() {
  if (!DB_AVAILABLE) return { pending: 0, resolved: 0, dismissed: 0 };
  try {
    const [pending, resolved, dismissed] = await Promise.all([
      db.report.count({ where: { status: "pending"   } }),
      db.report.count({ where: { status: "resolved"  } }),
      db.report.count({ where: { status: "dismissed" } }),
    ]);
    return { pending, resolved, dismissed };
  } catch {
    return { pending: 0, resolved: 0, dismissed: 0 };
  }
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getAdminUser();
  if (!user || !isAdmin(user)) notFound();

  const { status = "pending" } = await searchParams;
  const [{ reports, total }, counts] = await Promise.all([
    getReports(status),
    getCounts(),
  ]);

  return (
    <PageTransition>
      <ModerationClient
        initialReports={reports}
        initialTotal={total}
        initialStatus={status}
        counts={counts}
      />
    </PageTransition>
  );
}
