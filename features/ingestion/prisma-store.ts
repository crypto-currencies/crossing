/**
 * Prisma/Postgres snapshot store — the production persistence for versioned
 * evidence. Append-only; the `EvidenceSnapshot` unique index on
 * (entityId, contentFingerprint) enforces content dedup at the database level.
 * Failed attempts are stored (ok=false) without touching the latest valid row.
 * Full raw HTML is never stored — only hashes + constrained excerpts (already
 * enforced upstream in extraction/snapshot).
 */

import { db } from "@/lib/db";
import type { SnapshotStore } from "./store";
import type { EvidenceSnapshot } from "./snapshot";

// Minimal shape of a persisted row (avoids importing generated types at module load).
interface Row {
  id: string;
  entityId: string;
  adapterId: string;
  primarySourceUrl: string;
  retrievedAt: Date;
  ok: boolean;
  httpStatus: number | null;
  httpMeta: unknown;
  contentFingerprint: string;
  extractionVersion: string;
  attributes: unknown;
  pricing: unknown;
  provenance: unknown;
  pages: unknown;
  confidence: number;
  freshnessStatus: string;
  warnings: unknown;
  errorKind: string | null;
  errorMessage: string | null;
}

function representativeStatus(s: EvidenceSnapshot): number | null {
  return s.pages.find((p) => p.ok && p.status != null)?.status ?? s.pages[0]?.status ?? null;
}

function toRow(s: EvidenceSnapshot) {
  return {
    id: s.id,
    entityId: s.entityId,
    adapterId: s.adapterId,
    primarySourceUrl: s.primarySourceUrl,
    retrievedAt: new Date(s.retrievedAt),
    ok: s.ok,
    httpStatus: representativeStatus(s),
    httpMeta: s.http,
    contentFingerprint: s.contentFingerprint,
    extractionVersion: s.extractionVersion,
    attributes: s.attributes,
    pricing: s.pricing,
    provenance: s.provenance,
    pages: s.pages,
    confidence: s.confidence,
    freshnessStatus: s.freshnessStatus,
    warnings: s.warnings,
    errorKind: s.error?.kind ?? null,
    errorMessage: s.error?.message ?? null,
  };
}

function fromRow(r: Row): EvidenceSnapshot {
  return {
    id: r.id,
    entityId: r.entityId,
    adapterId: r.adapterId,
    primarySourceUrl: r.primarySourceUrl,
    retrievedAt: r.retrievedAt.toISOString(),
    ok: r.ok,
    extractionVersion: r.extractionVersion,
    http: r.httpMeta as EvidenceSnapshot["http"],
    contentFingerprint: r.contentFingerprint,
    attributes: r.attributes as EvidenceSnapshot["attributes"],
    pricing: r.pricing as EvidenceSnapshot["pricing"],
    provenance: r.provenance as EvidenceSnapshot["provenance"],
    confidence: r.confidence,
    freshnessStatus: r.freshnessStatus as EvidenceSnapshot["freshnessStatus"],
    pages: r.pages as EvidenceSnapshot["pages"],
    warnings: r.warnings as string[],
    error: r.errorKind ? { kind: r.errorKind, message: r.errorMessage ?? "" } : null,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

/** The subset of the Prisma delegate this store uses (injectable for tests). */
export interface EvidenceSnapshotDelegate {
  create(args: { data: ReturnType<typeof toRow> }): Promise<unknown>;
  findFirst(args: unknown): Promise<Row | null>;
  findMany(args: unknown): Promise<Row[]>;
}

export class PrismaSnapshotStore implements SnapshotStore {
  constructor(private readonly injected?: EvidenceSnapshotDelegate) {}

  private get model(): EvidenceSnapshotDelegate {
    if (this.injected) return this.injected;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (db as any).evidenceSnapshot as EvidenceSnapshotDelegate;
  }

  async append(snapshot: EvidenceSnapshot): Promise<void> {
    try {
      await this.model.create({ data: toRow(snapshot) });
    } catch (e) {
      // Identical content already stored → treat as a dedup no-op (append-only history).
      if (isUniqueViolation(e)) return;
      throw e;
    }
  }

  async latest(entityId: string): Promise<EvidenceSnapshot | null> {
    const row = await this.model.findFirst({ where: { entityId }, orderBy: { retrievedAt: "desc" } });
    return row ? fromRow(row) : null;
  }

  async latestValid(entityId: string): Promise<EvidenceSnapshot | null> {
    const row = await this.model.findFirst({ where: { entityId, ok: true }, orderBy: { retrievedAt: "desc" } });
    return row ? fromRow(row) : null;
  }

  async history(entityId: string, limit = 20): Promise<EvidenceSnapshot[]> {
    const rows: Row[] = await this.model.findMany({ where: { entityId }, orderBy: { retrievedAt: "desc" }, take: limit });
    return rows.map(fromRow);
  }

  async allLatest(): Promise<Map<string, EvidenceSnapshot>> {
    const rows: Row[] = await this.model.findMany({ distinct: ["entityId"], orderBy: { retrievedAt: "desc" } });
    return new Map(rows.map((r) => [r.entityId, fromRow(r)]));
  }
}
