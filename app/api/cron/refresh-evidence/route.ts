import { NextResponse } from "next/server";
import { listApprovedSources } from "@/features/ingestion/registry";
import { ingestEntity } from "@/features/ingestion/service";
import { getRefreshConfig, selectRefreshBatch } from "@/features/ingestion/config";
import { getDefaultSnapshotStore } from "@/features/ingestion/store";

// ─── /api/cron/refresh-evidence ────────────────────────────────────────────────
// Scheduled evidence refresh. Reuses the ingestion service (no duplicate crawl
// logic). CRON_SECRET-guarded, never public. Refreshes only ENABLED approved
// entities, skips fresh evidence, respects robots + cadence (via the service),
// isolates per-entity failures, is time-bounded, and paginates deterministically.
//
// Vercel Cron invokes this GET with `Authorization: Bearer $CRON_SECRET`.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured → refuse (never open)
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = getRefreshConfig();
  const store = getDefaultSnapshotStore();
  const now = new Date();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  // Enabled sources only, category-filtered, deterministically ordered + paginated.
  const { batch, nextCursor: pageCursor, total } = selectRefreshBatch(listApprovedSources(), cursor, cfg);

  const started = Date.now();
  const results: { entityId: string; outcome: string }[] = [];
  let processed = 0;

  for (const s of batch) {
    if (Date.now() - started > cfg.maxDurationMs) break; // time budget

    // Retry policy: unless retryFailed, skip an entity whose most-recent attempt
    // failed and is still within the staleness window (avoid hammering a broken site).
    if (!cfg.retryFailed) {
      const latest = await store.latest(s.entityId);
      if (latest && !latest.ok && now.getTime() - new Date(latest.retrievedAt).getTime() < cfg.stalenessThresholdMs) {
        results.push({ entityId: s.entityId, outcome: "skipped_failed" });
        processed++;
        continue;
      }
    }

    const r = await ingestEntity(s.entityId, { store, now, freshWithinMs: cfg.stalenessThresholdMs });
    results.push({ entityId: s.entityId, outcome: r.results[0]?.outcome ?? "skipped_fresh" });
    processed++;
  }

  const summary = {
    processed,
    total,
    batchSize: cfg.batchSize,
    nextCursor: pageCursor,
    durationMs: Date.now() - started,
    results,
  };
  console.log(JSON.stringify({ evt: "ingestion.cron", ...summary }));
  return NextResponse.json(summary, { status: 200 });
}
