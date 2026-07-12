import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";
import { db, DB_AVAILABLE } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET(request: NextRequest) {
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

  // Resolve the session token for clients that need it (e.g. OAuth callback bridge).
  // We return it only if it was already present in the request (cookie or Bearer),
  // so there is no new disclosure — the client already holds it.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  const resolvedToken = bearerToken || cookieToken;

  return NextResponse.json({
    user: mapUser(full, { includeEmail: true }),
    ...(resolvedToken ? { token: resolvedToken } : {}),
  });
}
