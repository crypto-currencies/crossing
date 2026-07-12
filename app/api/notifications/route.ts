import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import { mapNotification } from "@/lib/server/mappers";

// ─── GET /api/notifications ────────────────────────────────────────────────────
// Returns the authenticated user's notifications (newest first).
// When DB is unavailable, returns an empty result rather than an error.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  return NextResponse.json({
    items: items.map(mapNotification),
    unreadCount,
  });
}

// ─── PATCH /api/notifications ──────────────────────────────────────────────────
// Mark notifications as read.
// Body: { ids: string[] } or { all: true }

export async function PATCH(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ ok: true });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isSuspended(user)) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }

  let body: { ids?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.all === true) {
    await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const ids = body.ids.filter((id): id is string => typeof id === "string");
    await db.notification.updateMany({
      where: { userId: user.id, id: { in: ids } },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_body" }, { status: 400 });
}

// ─── POST /api/notifications ───────────────────────────────────────────────────
// Create a notification for a target user.
// Server-internal only: requires the X-Internal-Secret header matching
// the INTERNAL_NOTIFICATIONS_SECRET environment variable.

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ ok: true });
  }

  // Reject any request that doesn't carry the internal server secret.
  // This endpoint must never be callable by end-users via the browser.
  const secret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_NOTIFICATIONS_SECRET;
  if (!expectedSecret || !secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Use timing-safe comparison to prevent timing-based secret extraction
  const secretMatches = (() => {
    try {
      const a = Buffer.from(secret);
      const b = Buffer.from(expectedSecret);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  })();
  if (!secretMatches) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    userId?: unknown;
    type?: unknown;
    title?: unknown;
    body?: unknown;
    href?: unknown;
    entityId?: unknown;
    entityType?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body.userId !== "string" ||
    typeof body.type !== "string" ||
    typeof body.title !== "string" ||
    typeof body.body !== "string" ||
    (body.title as string).length > 200 ||
    (body.body as string).length > 500
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const notif = await db.notification.create({
    data: {
      userId: body.userId,
      type: body.type,
      title: body.title,
      body: body.body as string,
      href: typeof body.href === "string" ? body.href.slice(0, 500) : null,
      entityId: typeof body.entityId === "string" ? body.entityId : null,
      entityType: typeof body.entityType === "string" ? body.entityType : null,
    },
  });

  return NextResponse.json({ id: notif.id }, { status: 201 });
}
