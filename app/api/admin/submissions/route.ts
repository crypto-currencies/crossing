import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";
import { parsePageParams } from "@/lib/server/pagination";
import { listSubmissionsForAdmins } from "@/features/submissions/data";
import { mapAdminSubmission } from "@/features/submissions/dto";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

// ─── GET /api/admin/submissions?status=PENDING|APPROVED|REJECTED ─────────────
// Requires ADMIN or OWNER role. Defaults to PENDING (the live moderation
// queue, oldest first); other statuses are review history, newest first.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status")?.toUpperCase() ?? "PENDING";
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as (typeof VALID_STATUSES)[number])
    : "PENDING";
  const page = parsePageParams(searchParams);

  const result = await listSubmissionsForAdmins(status, page);
  return NextResponse.json({ ...result, items: result.items.map(mapAdminSubmission) });
}
