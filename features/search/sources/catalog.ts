/**
 * Catalog discovery source — the canonical Entity table.
 *
 * This is the ONLY discovery source that is real today. It is deliberately
 * modest about that: it reports exactly how many entities the catalog holds for
 * a category, so the pipeline can emit a truthful `sparse` response instead of
 * presenting a 2-row table as if it were the market
 * (docs/live-search-architecture.md §1.3, §1.5).
 *
 * It is a DiscoverySource rather than the retrieval step itself because the
 * catalog is meant to become one input among several — once a broader source is
 * approved and implemented, it registers alongside this one and the dedup stage
 * merges their leads. Nothing downstream changes.
 */

import type { EntityRepository } from "@/features/entities/repository";
import type { CandidateLead, SearchContext } from "../contracts";
import { issue } from "../contracts";
import type { DiscoveryOutcome, DiscoveryRequest, DiscoverySource, SourceDescriptor } from "./types";

export const CATALOG_SOURCE_ID = "catalog";

export class CatalogDiscoverySource implements DiscoverySource {
  readonly descriptor: SourceDescriptor = {
    id: CATALOG_SOURCE_ID,
    label: "Crossing catalog",
    // The catalog records which products exist; it makes no quality claim, and
    // its rows are curated by us rather than supplied by the vendor.
    independence: "independent",
    network: false,
  };

  /** See ResolveEntitiesStage — `requireCanonical` is a deployment choice. */
  constructor(
    private readonly repo: EntityRepository,
    private readonly requireCanonical = true
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async discover(request: DiscoveryRequest, ctx: SearchContext): Promise<DiscoveryOutcome> {
    void ctx;
    try {
      const page = await this.repo.findCandidates({
        categoryId: request.categoryId,
        requireCanonical: this.requireCanonical,
        limit: request.limit,
      });

      const leads: CandidateLead[] = page.entities.map((e) => ({
        rawName: e.canonicalName,
        url: e.officialDomain,
        sourceId: CATALOG_SOURCE_ID,
        sourceUrl: e.officialDomain,
        // A curated catalog row is a certain lead — we know the product exists.
        // This is an identity statement, never a quality one.
        leadConfidence: 1,
      }));

      return { leads, issues: [], externalCalls: 0 };
    } catch (err) {
      return {
        leads: [],
        issues: [
          issue(
            "discover",
            "source_unavailable",
            `Catalog lookup failed: ${err instanceof Error ? err.name : "unknown error"}`,
            CATALOG_SOURCE_ID
          ),
        ],
        externalCalls: 0,
      };
    }
  }
}
