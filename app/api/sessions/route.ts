import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, extractCurrentToken } from "@/lib/server/auth";
import { writeSecurityEvent } from "@/lib/server/security";
import { clientIp } from "@/lib/server/rate-limit";

// ─── GET /api/sessions ────────────────────────────────────────────────────────
// Returns all active (non-expired) sessions for the current user.
// The session matching the current request is marked current: true.
// Session tokens are NEVER returned — only IDs and metadata.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const currentToken = extractCurrentToken(request);
  const now = new Date();

  const sessions = await db.session.findMany({
    where:   { userId: user.id, expires: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    take:    100, // most-recently-active first; caps payload for pathological session counts
    select: {
      id:           true,
      deviceHint:   true,
      maskedIp:     true,
      createdAt:    true,
      lastSeenAt:   true,
      expires:      true,
      sessionToken: true, // only to compare, never returned
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id:          s.id,
      deviceHint:  s.deviceHint ?? "Unknown device",
      type:        detectType(s.deviceHint),
      maskedIp:    s.maskedIp ?? null,
      createdAt:   s.createdAt.toISOString(),
      lastSeenAt:  s.lastSeenAt.toISOString(),
      expires:     s.expires.toISOString(),
      current:     currentToken ? s.sessionToken === currentToken : false,
    })),
  });
}

// ─── DELETE /api/sessions ─────────────────────────────────────────────────────
// Revoke all sessions except the current one.

export async function DELETE(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const currentToken = extractCurrentToken(request);

  // Find current session to keep
  const currentSession = currentToken
    ? await db.session.findUnique({ where: { sessionToken: currentToken }, select: { id: true } })
    : null;

  const { count } = await db.session.deleteMany({
    where: {
      userId: user.id,
      ...(currentSession ? { id: { not: currentSession.id } } : {}),
    },
  });

  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;
  void writeSecurityEvent({ userId: user.id, type: "sessions_revoked_all", ip, userAgent: ua,
    metadata: { count } });

  return NextResponse.json({ ok: true, revoked: count });
}

function detectType(deviceHint: string | null): "browser" | "mobile" {
  if (!deviceHint) return "browser";
  return /iPhone|iPad|Android|Mobile|iOS/i.test(deviceHint) ? "mobile" : "browser";
}
