/**
 * Batched Prisma evidence loader for `PrismaEntityRepository`.
 *
 * One query for the whole candidate page (never per-entity), reusing the exact
 * same normalization the ingestion pipeline already uses to turn a stored
 * snapshot into a `recommendation` `Evidence` record — so a DB-backed result and
 * an ingestion-audit view of the same snapshot can never disagree.
 */

import { db } from "@/lib/db";
import { toRecommendationEvidence } from "@/features/ingestion/evidence";
import type { PricingModel } from "@/features/ingestion/pricing";
import type { AttributeProvenance } from "@/features/ingestion/snapshot";
import type { Evidence } from "@/features/recommendation/evidence/types";
import type { EvidenceLoader } from "./repository";

interface SnapshotRow {
  entityId: string;
  attributes: unknown;
  pricing: unknown;
  provenance: unknown;
  confidence: number;
  primarySourceUrl: string;
  retrievedAt: Date;
}

/** Minimal delegate shape, injectable so tests need no database. */
export interface EvidenceSnapshotDelegate {
  findMany(args: unknown): Promise<SnapshotRow[]>;
}

/**
 * `entityId` on `EvidenceSnapshot` is the entity's stable public key (matches
 * the ingestion registry id), the same key `Entity.key` uses — so this loader
 * takes the SAME keys `findCandidates` returns entities under.
 */
export function createEvidenceLoader(delegate: EvidenceSnapshotDelegate): EvidenceLoader {
  return async (entityKeys: string[]): Promise<Map<string, Evidence[]>> => {
    if (entityKeys.length === 0) return new Map();

    const rows = await delegate.findMany({
      where: { entityId: { in: entityKeys }, ok: true },
      orderBy: { retrievedAt: "desc" },
      select: {
        entityId: true,
        attributes: true,
        pricing: true,
        provenance: true,
        confidence: true,
        primarySourceUrl: true,
        retrievedAt: true,
      },
    });

    // Rows are ordered newest-first; keep only the first (latest) per entity.
    const latestByKey = new Map<string, SnapshotRow>();
    for (const row of rows) {
      if (!latestByKey.has(row.entityId)) latestByKey.set(row.entityId, row);
    }

    const out = new Map<string, Evidence[]>();
    for (const [key, row] of latestByKey) {
      const normalized = {
        attributes: (row.attributes ?? {}) as Record<string, string | number | boolean>,
        provenance: (row.provenance ?? []) as AttributeProvenance[],
        pricing: row.pricing as PricingModel,
        confidence: row.confidence,
      };
      out.set(key, [toRecommendationEvidence(normalized, row.primarySourceUrl, row.retrievedAt.toISOString())]);
    }
    return out;
  };
}

/** The process-wide loader backed by the real database. */
export function createDefaultEvidenceLoader(): EvidenceLoader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createEvidenceLoader((db as any).evidenceSnapshot);
}
