import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { submissionApproveOverridesSchema } from "@/features/submissions/validation";
import { approveSubmission } from "@/features/submissions/data";

// ─── POST /api/admin/submissions/[id]/approve ─────────────────────────────────
// Requires ADMIN or OWNER role. Creates a published Listing from the submission.
// Body (optional): { name?, websiteUrl?, tagline?, description? } — lets an
// admin correct obvious formatting issues before the listing goes public.

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

  const parsed = submissionApproveOverridesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const result = await approveSubmission(id, admin.id, parsed.data);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  await writeAuditLog({
    adminId: admin.id,
    action: "submission.approve",
    targetUserId: undefined,
    metadata: { submissionId: id, listingSlug: result.listingSlug, edited: Object.keys(parsed.data).length > 0 },
  });

  return NextResponse.json({ ok: true, listingSlug: result.listingSlug });
}
