/**
 * Official-site evidence source — stored ingestion snapshots.
 *
 * Declared `independence: "vendor"`. That single field is what stops the audit's
 * §1.9 failure mode: the gatherEvidence stage will strip any rating or review
 * count this source emits, and the ranking stage will not count it toward
 * reputation. It contributes FACTS ONLY — price, free plan, platforms.
 *
 * Reads the snapshot store; it never crawls. Crawling remains the scheduled
 * ingestion job's responsibility (features/ingestion/service.ts).
 */

import type { EvidenceLoader } from "@/features/entities/repository";
import type { SearchContext } from "../contracts";
import { issue } from "../contracts";
import type {
  BatchEvidenceOutcome,
  BatchEvidenceSource,
  EvidenceOutcome,
  EvidenceRequest,
  EvidenceSource,
  SourceDescriptor,
} from "./types";

export const OFFICIAL_SITE_SOURCE_ID = "official-site";

export class OfficialSiteEvidenceSource implements EvidenceSource {
  readonly descriptor: SourceDescriptor = {
    id: OFFICIAL_SITE_SOURCE_ID,
    label: "Official site",
    // The vendor describing itself. Facts are usable; opinions are not.
    independence: "vendor",
    network: false,
  };

  constructor(private readonly loadEvidence: EvidenceLoader) {}

  isAvailable(): boolean {
    return true;
  }

  async gather(request: EvidenceRequest, ctx: SearchContext): Promise<EvidenceOutcome> {
    void ctx;
    try {
      const byKey = await this.loadEvidence([request.entityId]);
      const evidence = byKey.get(request.entityId) ?? [];
      return {
        evidence,
        issues: evidence.length
          ? []
          : [
              issue(
                "gatherEvidence",
                "field_absent",
                "No stored official-site snapshot for this entity.",
                request.entityId
              ),
            ],
        externalCalls: 0,
      };
    } catch (err) {
      return {
        evidence: [],
        issues: [
          issue(
            "gatherEvidence",
            "source_unavailable",
            `Snapshot lookup failed: ${err instanceof Error ? err.name : "unknown error"}`,
            request.entityId
          ),
        ],
        externalCalls: 0,
      };
    }
  }
}

/**
 * Batched fast path — one store read for the whole candidate set rather than
 * one per entity, which is what prevents an N+1 when a category returns 20
 * candidates. The stage prefers `gatherMany` when a source implements it.
 */
export class BatchedOfficialSiteEvidenceSource
  extends OfficialSiteEvidenceSource
  implements BatchEvidenceSource
{
  constructor(private readonly loader: EvidenceLoader) {
    super(loader);
  }

  async gatherMany(requests: EvidenceRequest[], ctx: SearchContext): Promise<BatchEvidenceOutcome> {
    void ctx;
    if (requests.length === 0) {
      return { byEntity: new Map(), issues: [], externalCalls: 0 };
    }
    try {
      const byEntity = await this.loader(requests.map((r) => r.entityId));
      const issues = requests
        .filter((r) => !byEntity.get(r.entityId)?.length)
        .map((r) =>
          issue(
            "gatherEvidence",
            "field_absent",
            "No stored official-site snapshot for this entity.",
            r.entityId
          )
        );
      return { byEntity, issues, externalCalls: 0 };
    } catch (err) {
      return {
        byEntity: new Map(),
        issues: [
          issue(
            "gatherEvidence",
            "source_unavailable",
            `Batched snapshot lookup failed: ${err instanceof Error ? err.name : "unknown error"}`,
            OFFICIAL_SITE_SOURCE_ID
          ),
        ],
        externalCalls: 0,
      };
    }
  }
}
