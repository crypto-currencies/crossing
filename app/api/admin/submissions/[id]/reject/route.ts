import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { submissionRejectSchema } from "@/features/submissions/validation";
import { rejectSubmission } from "@/features/submissions/data";

// ─── POST /api/admin/submissions/[id]/reject ───────────────────────────────────
// Requires ADMIN or OWNER role. Body: { moderatorNote?: string }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const admin = await requireAdminApi(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = submissionRejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const result = await rejectSubmission(id, admin.id, parsed.data.moderatorNote);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  await writeAuditLog({
    adminId: admin.id,
    action: "submission.reject",
    targetUserId: undefined,
    metadata: { submissionId: id, moderatorNote: parsed.data.moderatorNote ?? null },
  });

  return NextResponse.json({ ok: true });
}
