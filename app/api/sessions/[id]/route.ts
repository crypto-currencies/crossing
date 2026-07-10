import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, extractCurrentToken } from "@/lib/server/auth";
import { writeSecurityEvent } from "@/lib/server/security";
import { clientIp } from "@/lib/server/rate-limit";

interface Params { params: Promise<{ id: string }> }

// ─── DELETE /api/sessions/[id] ────────────────────────────────────────────────
// Revoke a specific session by ID. Cannot revoke the current session.

export async function DELETE(request: Request, { params }: Params) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await db.session.findUnique({ where: { id }, select: { userId: true, sessionToken: true } });
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Prevent revoking the current session through this endpoint
  const currentToken = extractCurrentToken(request);
  if (currentToken && session.sessionToken === currentToken) {
    return NextResponse.json({ error: "cannot_revoke_current", message: "Use sign-out to end the current session." }, { status: 400 });
  }

  await db.session.delete({ where: { id } });

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: user.id, type: "session_revoked", ip, userAgent: ua,
    metadata: { revokedSessionId: id } });

  return NextResponse.json({ ok: true });
}
