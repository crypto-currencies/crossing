import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { storageDelete } from "@/lib/storage";
import { isManagedStorageUrl } from "@/lib/server/storage";

const DELETION_GRACE_DAYS = 7;

// ─── GET /api/cron/cleanup-deleted-accounts ───────────────────────────────────
// Hard-deletes users whose deletionScheduledAt is older than DELETION_GRACE_DAYS.
// Invoked by Vercel Cron daily — authenticated via Authorization: Bearer {CRON_SECRET}.
// Cascade deletes on User remove all related rows (sessions, notifications, etc.).
// An uploaded avatar blob is deleted explicitly before the DB row is removed.

export async function GET(request: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/cleanup] CRON_SECRET is not set — route is disabled");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // ── Find expired accounts ──────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: {
      deletionScheduledAt: { lte: cutoff },
    },
    select: {
      id:    true,
      email: true,
      image: true,
    },
  });

  if (users.length === 0) {
    console.log("[cron/cleanup] No accounts due for deletion.");
    return NextResponse.json({ deleted: 0 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const user of users) {
    try {
      // Delete the uploaded avatar blob (if any) before removing the DB row.
      if (user.image && isManagedStorageUrl(user.image)) {
        await storageDelete(user.image).catch(() => {});
      }

      // Hard-delete — Prisma cascade removes all related rows: sessions,
      // notifications, securityEvents, backupCodes, reports, support tickets.
      await db.user.delete({ where: { id: user.id } });

      results.push({ id: user.id, ok: true });
      console.log(`[cron/cleanup] Deleted account: ${user.id}`);
    } catch (err) {
      results.push({ id: user.id, ok: false, error: String(err) });
      console.error(`[cron/cleanup] Failed to delete account ${user.id}:`, err);
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed    = results.filter((r) => !r.ok).length;

  console.log(`[cron/cleanup] Done — deleted: ${succeeded}, failed: ${failed}`);

  return NextResponse.json({
    deleted:  succeeded,
    failed,
    accounts: results,
  });
}
