import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { db, DB_AVAILABLE } from "@/lib/db";

/**
 * GET /api/me
 *
 * Returns the authenticated user regardless of auth method:
 * - Authorization: Bearer <token>  (Zustand store)
 * - session_token cookie           (email/password, magic link)
 * - next-auth.session-token cookie (Google, Discord OAuth)
 *
 * Used by Providers to recover a real session when the Zustand
 * Bearer token has been invalidated but a valid cookie still exists.
 */
export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const full = await db.user.findUnique({ where: { id: user.id } });

  if (!full) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ user: mapUser(full, { includeEmail: true }) });
}
