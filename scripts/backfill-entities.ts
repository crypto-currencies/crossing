/**
 * Canonical entity backfill (P2).
 *
 *   npm run backfill:entities -- --dry-run
 *   npm run backfill:entities
 *
 * Idempotent: re-running updates existing rows in place (matched on the stable
 * `key`) and never duplicates. It only ever writes rows from
 * features/entities/canonical.ts, so fictional fixtures can never be promoted
 * into production data by accident.
 *
 * Additive by design — it does not delete or archive anything it didn't create.
 */

import { config } from "dotenv";
import { db } from "@/lib/db";
import { normalizeDomainKey } from "@/features/recommendation/entities/normalize";
import { CANONICAL_ENTITIES } from "@/features/entities/canonical";

// `dotenv` alone only reads `.env`; DATABASE_URL lives in `.env.local` (the
// Next.js convention), same as prisma.config.ts. lib/db.ts creates its client
// lazily, so loading here — before the first query — is sufficient.
config({ path: ".env.local" });
config();

interface Outcome {
  key: string;
  action: "created" | "updated" | "unchanged" | "would-create" | "would-update";
  status: string;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = db as any;
  const outcomes: Outcome[] = [];

  for (const seed of CANONICAL_ENTITIES) {
    const domainKey = normalizeDomainKey(seed.officialDomain);
    const existing = await client.entity.findUnique({ where: { key: seed.key } });

    const data = {
      key: seed.key,
      canonicalName: seed.canonicalName,
      categoryId: seed.categoryId,
      officialDomain: seed.officialDomain,
      domainKey,
      description: seed.description,
      attributes: seed.attributes,
      status: seed.status,
      source: "CANONICAL" as const,
      lastUpdatedAt: new Date(),
    };

    if (dryRun) {
      outcomes.push({ key: seed.key, action: existing ? "would-update" : "would-create", status: seed.status });
      continue;
    }

    if (!existing) {
      await client.entity.create({
        data: {
          ...data,
          aliases: { create: seed.aliases.map((alias) => ({ alias: alias.toLowerCase() })) },
        },
      });
      outcomes.push({ key: seed.key, action: "created", status: seed.status });
      continue;
    }

    // Update in place; aliases are reconciled additively so manual additions survive.
    await client.entity.update({ where: { key: seed.key }, data });
    for (const alias of seed.aliases) {
      await client.entityAlias.upsert({
        where: { entityId_alias: { entityId: existing.id, alias: alias.toLowerCase() } },
        create: { entityId: existing.id, alias: alias.toLowerCase() },
        update: {},
      });
    }
    outcomes.push({ key: seed.key, action: "updated", status: seed.status });
  }

  console.log(`\nCanonical entity backfill${dryRun ? " (dry-run)" : ""}:\n`);
  for (const o of outcomes) {
    console.log(`  ${o.action.padEnd(13)} ${o.key.padEnd(22)} status=${o.status}`);
  }

  if (!dryRun) {
    const active = await client.entity.count({ where: { source: "CANONICAL", status: "ACTIVE" } });
    const demo = await client.entity.count({ where: { source: "DEMO" } });
    console.log(`\n  ACTIVE canonical entities: ${active}`);
    console.log(`  DEMO entities in database: ${demo} (must be 0 in production)\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).$disconnect?.();
  });
