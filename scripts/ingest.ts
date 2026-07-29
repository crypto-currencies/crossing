/**
 * Development CLI for evidence ingestion.
 *
 *   npm run ingest -- --all --dry-run
 *   npm run ingest -- --entity glyph-code
 *   npm run ingest -- --category analytics-tools --force
 *
 * Disabled in production unless INGESTION_ALLOW_PROD=true. Never fetches user-
 * supplied URLs — only the approved registry.
 */

import { config } from "dotenv";
import { ingestEntity, ingestCategory, ingestAll } from "@/features/ingestion/service";
import { ingestionToolEnabled } from "@/features/ingestion/access";
import type { IngestionRunResult } from "@/features/ingestion/types";

// `tsx scripts/ingest.ts` does not auto-load env files the way `next dev` does.
// DATABASE_URL and INGESTION_STORE both live in `.env.local` (the Next.js
// convention) — without this, the snapshot store silently resolves to
// file/memory instead of Prisma even when INGESTION_STORE=prisma is set.
config({ path: ".env.local" });
config();

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}
function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if (!ingestionToolEnabled()) {
    console.error("Ingestion is disabled in production. Set INGESTION_ALLOW_PROD=true to override.");
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "dry-run");
  const force = hasFlag(argv, "force");
  const opts = { dryRun, force };

  let result: IngestionRunResult;
  if (hasFlag(argv, "all")) {
    result = await ingestAll(opts);
  } else if (flagValue(argv, "category")) {
    result = await ingestCategory(flagValue(argv, "category")!, opts);
  } else if (flagValue(argv, "entity")) {
    result = await ingestEntity(flagValue(argv, "entity")!, opts);
  } else {
    console.error("Usage: ingest --all | --entity <id> | --category <id> [--dry-run] [--force]");
    process.exit(1);
  }

  console.log(
    `\nJob ${result.jobId}${result.dryRun ? " (dry-run)" : ""}: ` +
      `${result.created} created, ${result.deduplicated} deduped, ${result.skippedFresh} fresh, ${result.failed} failed of ${result.requested}\n`
  );
  for (const r of result.results) {
    const detail = r.snapshot?.error ? ` — ${r.snapshot.error.kind}` : r.diagnostics.errorClassification ? ` — ${r.diagnostics.errorClassification}` : "";
    console.log(`  ${r.outcome.padEnd(14)} ${r.entityId}${detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
