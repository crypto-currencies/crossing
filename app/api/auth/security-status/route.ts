import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";

// ─── GET /api/auth/security-status ───────────────────────────────────────────
// Returns account security state derived server-side.
// NEVER exposes passwordHash.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const sessionUser = await requireAuth(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where:  { id: sessionUser.id },
    select: { passwordHash: true, passwordChangedAt: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    hasPassword:       !!user.passwordHash,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
  });
}
