import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";

// ─── Valid report reasons ─────────────────────────────────────────────────────
const VALID_REASONS = [
  "impersonation",
  "harassment",
  "illegal_content",
  "copyright",
  "scam_phishing",
  "sexual_content",
  "malware",
  "spam",
  "other",
] as const;

// ─── POST /api/reports ────────────────────────────────────────────────────────
// Submit a profile report. Authenticated users only.
// Rate limit: max 3 reports against the same target within 24 hours.

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isSuspended(user)) {
    return NextResponse.json({ error: "suspended" }, { status: 403 });
  }

  let body: { targetUserId?: unknown; reason?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  const reason       = typeof body.reason === "string"       ? body.reason.trim()       : "";
  const details      = typeof body.details === "string"      ? body.details.trim()      : "";

  if (!targetUserId) {
    return NextResponse.json({ error: "missing_targetUserId" }, { status: 400 });
  }
  if (!(VALID_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "invalid_reason", valid: [...VALID_REASONS] }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "cannot_report_self" }, { status: 400 });
  }

  // ── Verify target exists ─────────────────────────────────────────────────
  const target = await db.user.findUnique({
    where:  { id: targetUserId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // ── Rate limit: max 3 reports against same target in last 24 hours ───────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await db.report.count({
    where: {
      reporterId:   user.id,
      targetUserId: targetUserId,
      createdAt:    { gte: since },
    },
  });
  if (recentCount >= 3) {
    return NextResponse.json(
      { error: "rate_limited", message: "You have already submitted several reports for this user. Please wait 24 hours." },
      { status: 429 }
    );
  }

  const report = await db.report.create({
    data: {
      reporterId:   user.id,
      targetUserId: targetUserId,
      reason,
      details:      details.slice(0, 1000),
      status:       "pending",
    },
  });

  return NextResponse.json({ id: report.id }, { status: 201 });
}
