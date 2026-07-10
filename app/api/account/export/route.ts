import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

// ─── GET /api/account/export ──────────────────────────────────────────────────
// Returns a complete export of the authenticated user's data as JSON.
// Sensitive fields (passwordHash, ipHash, sessionToken, TOTP secret) are
// never included — only the data that belongs to the user is returned.
// Rate-limited to 3 requests per hour per user.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = clientIp(request);
  if (!await rateLimit(`account-export:${user.id}:${ip}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  // Fetch all user data in parallel
  const [dbUser, sessions, securityEvents] =
    await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, name: true, email: true, image: true, verified: true,
          onboardingCompleted: true, role: true,
          twoFactorEnabled: true, twoFactorEnabledAt: true,
          createdAt: true, updatedAt: true,
          // Never exported: passwordHash, twoFactorSecret, twoFactorPendingSecret
        },
      }),
      db.session.findMany({
        where: { userId: user.id },
        select: {
          id: true, deviceHint: true, maskedIp: true,
          createdAt: true, lastSeenAt: true, expires: true,
          // Never exported: sessionToken, ipHash
        },
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      }),
      db.securityEvent.findMany({
        where: { userId: user.id },
        select: {
          id: true, type: true, metadata: true, createdAt: true,
          // Never exported: ipHash, userAgent (contains fingerprint data)
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1",
    account: dbUser,
    sessions: sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expires: s.expires.toISOString(),
    })),
    securityEvents: securityEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
  };

  const filename = `crossing-dev-export-${user.id}-${Date.now()}.json`;
  const json = JSON.stringify(exportPayload, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
