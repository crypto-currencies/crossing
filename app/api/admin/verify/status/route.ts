import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi } from "@/lib/server/admin";
import { stepUpSecondsLeft } from "@/lib/server/step-up";

// ─── GET /api/admin/verify/status ────────────────────────────────────────────
// Returns the admin's current step-up session state.
// Used by the client hook to decide whether to open the modal or proceed.
//
// Response:
//   { verified: true,  expiresAt: string, secondsLeft: number }
//   { verified: false, expiresAt: null,   secondsLeft: 0 }

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const admin = await requireAdminApi(request);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const secondsLeft = await stepUpSecondsLeft(admin.id);
  const verified    = secondsLeft > 0;
  const expiresAt   = verified
    ? new Date(Date.now() + secondsLeft * 1000).toISOString()
    : null;

  return NextResponse.json({ verified, expiresAt, secondsLeft });
}
