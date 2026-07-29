/**
 * Default production wiring for the staged orchestrator.
 *
 * Today exactly two adapters are real:
 *   - CatalogDiscoverySource     — the canonical Entity table
 *   - BatchedOfficialSiteEvidenceSource — stored ingestion snapshots (vendor)
 *
 * That is a deliberately honest starting set. No web-index discovery source and
 * no independent-review source is registered here, because neither exists yet —
 * and the orchestrator reports that absence through `coverage.gaps` and the
 * `sparse` status rather than papering over it
 * (docs/live-search-architecture.md §1.8, §2.5).
 *
 * Registering a new source is the ONLY change needed to add breadth; no stage
 * downstream of `discover` needs to know it happened.
 */

import { db } from "@/lib/db";
import { createDefaultEvidenceLoader } from "@/features/entities/evidence-loader";
import { PrismaEntityRepository, type EntityDelegate } from "@/features/entities/repository";
import { CatalogDiscoverySource } from "./sources/catalog";
import { BatchedOfficialSiteEvidenceSource } from "./sources/official-site";
import { StagedSearchOrchestrator, type OrchestratorDeps } from "./orchestrator";
import type { SearchOrchestrator } from "./contracts";

let _orchestrator: SearchOrchestrator | null = null;

/** Build the production orchestrator. Memoized — Prisma clients are expensive. */
export function getDefaultOrchestrator(): SearchOrchestrator {
  if (_orchestrator) return _orchestrator;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityDelegate = (db as any).entity as EntityDelegate;
  const loader = createDefaultEvidenceLoader();
  const repo = new PrismaEntityRepository(entityDelegate, loader);

  _orchestrator = new StagedSearchOrchestrator({
    repo,
    discoverySources: [new CatalogDiscoverySource(repo)],
    evidenceSources: [new BatchedOfficialSiteEvidenceSource(loader)],
    availabilityProbe: async (categoryId) => {
      const page = await repo.findCandidates({ categoryId, requireCanonical: true, limit: 1 });
      return page.total;
    },
  });
  return _orchestrator;
}

/** Test seam: override or reset the memoized orchestrator. */
export function setDefaultOrchestrator(orchestrator: SearchOrchestrator | null): void {
  _orchestrator = orchestrator;
}

/** Build an orchestrator from explicit deps — used by tests and previews. */
export function createOrchestrator(deps: OrchestratorDeps): SearchOrchestrator {
  return new StagedSearchOrchestrator(deps);
}
