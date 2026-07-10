/**
 * /control/admin — Owner-only control center.
 *
 * Security layers:
 *   1. app/(dashboard)/control/admin/layout.tsx — rejects non-admin (role < ADMIN) with notFound()
 *   2. This page — independently checks isAdmin() (belt-and-suspenders).
 *      Owner-only features (Access, Platform tabs) are hidden in the UI and
 *      protected by requireOwnerApi() in their respective API routes.
 *   3. All API routes backed by /api/admin/* call requireAdminApi() or requireOwnerApi().
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin, isOwner } from "@/lib/server/auth";
import { getAdminUser } from "@/lib/server/admin";
import { PageTransition } from "@/components/motion/page-transition";
import { AdminClient } from "@/components/admin/admin-client";
import { db, DB_AVAILABLE } from "@/lib/db";

export const metadata: Metadata = {
  title:  "Admin — Crossing.dev",
  robots: "noindex, nofollow",
};

async function getInitialStats() {
  if (!DB_AVAILABLE) return null;
  try {
    const now           = Date.now();
    const oneDayAgo     = new Date(now - 1  * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

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
    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      signups24h,
      signups7d,
      signups30d,
      suspendedUsers,
    };
  } catch {
    return null;
  }
}

export default async function ControlAdminPage() {
  const user = await getAdminUser();
  if (!user || !isAdmin(user)) {
    notFound();
  }

  const initialStats = await getInitialStats();
  const userRole = isOwner(user) ? "OWNER" : "ADMIN";

  return (
    <PageTransition>
      <AdminClient initialStats={initialStats} userRole={userRole} />
    </PageTransition>
  );
}
