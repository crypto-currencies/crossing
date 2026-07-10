import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi } from "@/lib/server/admin";

// ─── POST /api/admin/access/verify-code ──────────────────────────────────────
// Validates an OTP code without consuming it.
// Used as a preflight: the UI can check code validity before showing the
// final "confirm phrase" step so the owner isn't blocked by a typo.
// OWNER only.
//
// Body: { code, targetUserId, targetRole, action }

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const owner = await requireOwnerApi(request);
  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { code?: unknown; targetUserId?: unknown; targetRole?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code         = typeof body.code         === "string" ? body.code.trim()                      : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim()              : "";
  const targetRole   = typeof body.targetRole   === "string" ? body.targetRole.trim().toUpperCase()  : "";
  const action       = typeof body.action       === "string" ? body.action.trim().toLowerCase()      : "";

  if (!code || !targetUserId || !targetRole || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ valid: false, error: "invalid_code_format" }, { status: 200 });
  }

  const record = await db.roleGrantCode.findFirst({
    where: {
      codeHash:     hashCode(code),
      ownerId:      owner.id,
      targetUserId: targetUserId,
      targetRole:   targetRole,
      action:       action,
      used:         false,
      expiresAt:    { gt: new Date() },
    },
  });

  return NextResponse.json({ valid: !!record });
}
