import { NextResponse } from "next/server";
import { z } from "zod";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAdminApi, writeAuditLog } from "@/lib/server/admin";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { ingestionToolEnabled, isProduction } from "@/features/ingestion/access";
import { ingestEntity, ingestCategory, ingestAll } from "@/features/ingestion/service";
import { buildAuditRows, buildEntityAudit } from "@/features/ingestion/audit";
import { getDefaultSnapshotStore } from "@/features/ingestion/store";

// ─── /api/admin/ingestion ──────────────────────────────────────────────────────
// Dev-first, never public. POST triggers ingestion (one entity / category / all,
// with dry-run). GET returns audit data. In production the tool is disabled unless
// INGESTION_ALLOW_PROD=true, and always requires an ADMIN/OWNER session.

const triggerSchema = z.object({
  scope: z.enum(["entity", "category", "all"]),
  target: z.string().trim().min(1).max(64).optional(),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
});

async function authorize(request: Request): Promise<{ ok: true; adminId: string | null } | { ok: false; status: number; error: string }> {
  if (!ingestionToolEnabled()) return { ok: false, status: 404, error: "not_found" };
  if (isProduction()) {
    if (!DB_AVAILABLE) return { ok: false, status: 503, error: "db_unavailable" };
    const admin = await requireAdminApi(request);
    if (!admin) return { ok: false, status: 403, error: "forbidden" };
    return { ok: true, adminId: admin.id };
  }
  // Development: local-only tool.
  return { ok: true, adminId: null };
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`ingestion:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { scope, target, dryRun, force } = parsed.data;
  if ((scope === "entity" || scope === "category") && !target) {
    return NextResponse.json({ error: "target_required" }, { status: 400 });
  }

  const opts = { dryRun, force };
  const result =
    scope === "all"
      ? await ingestAll(opts)
      : scope === "category"
        ? await ingestCategory(target!, opts)
        : await ingestEntity(target!, opts);

  if (auth.adminId) {
    await writeAuditLog({
      adminId: auth.adminId,
      action: "ingestion.trigger",
      metadata: { scope, target: target ?? null, dryRun: !!dryRun, force: !!force, jobId: result.jobId, created: result.created, failed: result.failed },
    });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId");
  const store = getDefaultSnapshotStore();

  if (entityId) {
    const detail = await buildEntityAudit(entityId, store);
    if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(detail, { status: 200 });
  }

  const rows = await buildAuditRows(store);
  return NextResponse.json({ rows }, { status: 200 });
}
