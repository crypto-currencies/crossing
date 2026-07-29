/**
 * Process-wide `PrismaEntityRepository` singleton used by `runRecommendation`
 * when `FEATURE_DB_ENTITIES` is enabled. Kept in its own module (rather than
 * inline in recommend.ts) so recommend.ts never has a static import of
 * `@/lib/db` — the dynamic `import()` at the call site is what keeps Prisma out
 * of hermetic tests that never enable the flag.
 */

import { db } from "@/lib/db";
import { PrismaEntityRepository, type EntityDelegate } from "./repository";
import { createDefaultEvidenceLoader } from "./evidence-loader";

let _repo: PrismaEntityRepository | null = null;

export function getDefaultEntityRepository(): PrismaEntityRepository {
  if (_repo) return _repo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any).entity as EntityDelegate;
  _repo = new PrismaEntityRepository(delegate, createDefaultEvidenceLoader());
  return _repo;
}

/** Test seam: override or reset the singleton. */
export function setDefaultEntityRepository(repo: PrismaEntityRepository | null): void {
  _repo = repo;
}
