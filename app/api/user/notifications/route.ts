import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";

const DEFAULTS = {
  emailNotifications: true,
  pushEnabled:        true,
} as const;

type NotifPrefs = typeof DEFAULTS;

// ─── GET /api/user/notifications ──────────────────────────────────────────────

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "account_suspended" }, { status: 403 });

  const prefs = await db.userPreferences.findUnique({
    where: { userId: user.id },
    select: {
      emailNotifications: true,
      pushEnabled:         true,
    },
  });

  return NextResponse.json({ prefs: prefs ?? DEFAULTS });
}

// ─── PATCH /api/user/notifications ────────────────────────────────────────────

export async function PATCH(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "account_suspended" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const data: { -readonly [K in keyof NotifPrefs]?: boolean } = {};
  const boolKeys: (keyof NotifPrefs)[] = ["emailNotifications", "pushEnabled"];
  for (const key of boolKeys) {
    if (typeof body[key] === "boolean") {
      data[key] = body[key] as boolean;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  const prefs = await db.userPreferences.upsert({
    where:  { userId: user.id },
    create: { userId: user.id, ...DEFAULTS, ...data },
    update: data,
    select: {
      emailNotifications: true,
      pushEnabled:         true,
    },
  });

  return NextResponse.json({ prefs });
}
