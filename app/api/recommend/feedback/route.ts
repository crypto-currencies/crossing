import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { feedbackRequestSchema } from "@/features/recommendation/feedback";

// ─── POST /api/recommend/feedback ──────────────────────────────────────────────
// Public, rate-limited. Records lightweight result feedback.
//
// Phase 2: feedback is validated and structured-logged only, not persisted (see
// features/recommendation/feedback.ts for the rationale). Durable storage is
// additive later.

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`recommend-feedback:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = feedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Structured log only (no DB write this phase). Note is truncated by the
  // schema; nothing sensitive is stored server-side.
  console.log(
    JSON.stringify({
      evt: "recommend.feedback",
      requestId: parsed.data.requestId,
      kind: parsed.data.kind,
      entityId: parsed.data.entityId ?? null,
      hasNote: Boolean(parsed.data.note),
    })
  );

  return NextResponse.json({ ok: true, stored: false }, { status: 202 });
}
