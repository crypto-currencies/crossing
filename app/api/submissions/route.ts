import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { submissionCreateSchema } from "@/features/submissions/validation";
import { createSubmission } from "@/features/submissions/data";

// ─── POST /api/submissions ─────────────────────────────────────────────────────
// Authenticated. Creates a PENDING submission for moderation.
// Body: { name, websiteUrl, tagline, description, categoryId }

export async function POST(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "suspended" }, { status: 403 });

  if (!(await rateLimit(`submission:${clientIp(request)}:${user.id}`, 5, 60 * 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = submissionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createSubmission(user.id, parsed.data);
  if (!result.ok) {
    const status = result.error === "invalid_category" ? 400 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, submissionId: result.submission.id }, { status: 201 });
}
