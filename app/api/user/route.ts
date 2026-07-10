import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import { mapUser } from "@/lib/server/mappers";

// ─── PATCH /api/user ──────────────────────────────────────────────────────────
// Updates mutable fields on the authenticated user's own account.
// Supports: name, image (URL string).

export async function PATCH(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isSuspended(user)) {
    return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const data: { name?: string; image?: string } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length > 0 && trimmed.length <= 40) {
      data.name = trimmed;
    }
  }

  if (typeof body.image === "string") {
    const url = body.image.trim();
    // Allow empty string (clearing the avatar) or https:// URLs only
    if (url !== "" && !url.startsWith("https://")) {
      return NextResponse.json({ error: "invalid_image_url" }, { status: 400 });
    }
    data.image = url;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ user: mapUser(updated, { includeEmail: true }) });
}
