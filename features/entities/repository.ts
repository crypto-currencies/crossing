/**
 * Candidate retrieval (backend plan §2, Parts 6–7).
 *
 * Two implementations behind one interface:
 *   - `PrismaEntityRepository`  — production. Only `status=ACTIVE` AND
 *     `source=CANONICAL` rows are ever returned, so fictional demo data can not
 *     reach a production recommendation.
 *   - `FixtureEntityRepository` — hermetic tests and local demos. Explicitly
 *     labelled demo, and refuses to serve when `requireCanonical` is set.
 *
 * The deterministic ranking engine is unchanged: this layer only decides WHICH
 * candidates exist, ordered stably, before scoring.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import type { Evidence } from "@/features/recommendation/evidence/types";
import { normalizeDomainKey } from "@/features/recommendation/entities/normalize";

export type EntityStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED" | "CLOSED";
export type EntitySource = "CANONICAL" | "DEMO";

export interface CandidateQuery {
  categoryId: string;
  /** Defaults to ACTIVE only. */
  statuses?: EntityStatus[];
  /** Attribute equality filters applied in the datastore where possible. */
  attributes?: Record<string, string | number | boolean>;
  limit?: number;
  offset?: number;
  /** Production callers set this; a demo repository must then return nothing. */
  requireCanonical?: boolean;
}

export interface CandidatePage {
  entities: Entity[];
  total: number;
  /** Where the rows came from — surfaced in diagnostics, never fabricated. */
  source: EntitySource | "MIXED";
}

export interface EntityRepository {
  readonly kind: "prisma" | "fixture";
  findCandidates(query: CandidateQuery): Promise<CandidatePage>;
  findByKey(key: string): Promise<Entity | null>;
}

/** Deterministic ordering applied BEFORE ranking so results never flap. */
export function stableOrder(entities: Entity[]): Entity[] {
  return [...entities].sort((a, b) => a.id.localeCompare(b.id));
}

function attributesMatch(entity: Entity, filters?: Record<string, string | number | boolean>): boolean {
  if (!filters) return true;
  for (const [key, want] of Object.entries(filters)) {
    const have = entity.attributes[key];
    if (have === undefined) return false;
    if (String(have).toLowerCase() !== String(want).toLowerCase()) return false;
  }
  return true;
}

// ─── Prisma (production) ──────────────────────────────────────────────────────

/** Minimal delegate shape, injectable so tests need no database. */
export interface EntityDelegate {
  findMany(args: unknown): Promise<PrismaEntityRow[]>;
  count(args: unknown): Promise<number>;
  findUnique(args: unknown): Promise<PrismaEntityRow | null>;
}

export interface PrismaEntityRow {
  id: string;
  key: string;
  canonicalName: string;
  categoryId: string;
  officialDomain: string;
  domainKey: string;
  description: string;
  attributes: unknown;
  status: EntityStatus;
  source: EntitySource;
  lastUpdatedAt: Date;
  aliases?: { alias: string }[];
  externalIds?: { sourceType: string; externalId: string; url: string }[];
}

/**
 * Evidence is supplied by a loader that fetches ALL entities' snapshots in one
 * query — this is what prevents an N+1 when a category returns many candidates.
 */
export type EvidenceLoader = (entityKeys: string[]) => Promise<Map<string, Evidence[]>>;

export function rowToEntity(row: PrismaEntityRow, evidence: Evidence[] = []): Entity {
  return {
    // The engine keys everything off the stable public key, not the cuid, so
    // fixture ids and DB ids stay interchangeable for ranking + saved items.
    id: row.key,
    canonicalName: row.canonicalName,
    officialDomain: row.officialDomain,
    domainKey: row.domainKey || normalizeDomainKey(row.officialDomain),
    categoryId: row.categoryId,
    aliases: (row.aliases ?? []).map((a) => a.alias),
    description: row.description,
    attributes: (row.attributes ?? {}) as Entity["attributes"],
    externalIds: (row.externalIds ?? []).map((e) => ({
      sourceType: e.sourceType,
      externalId: e.externalId,
      url: e.url,
    })),
    evidence,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  };
}

export class PrismaEntityRepository implements EntityRepository {
  readonly kind = "prisma" as const;

  constructor(
    private readonly delegate: EntityDelegate,
    private readonly loadEvidence: EvidenceLoader = async () => new Map()
  ) {}

  async findCandidates(query: CandidateQuery): Promise<CandidatePage> {
    const statuses = query.statuses ?? ["ACTIVE"];
    const where = {
      categoryId: query.categoryId,
      status: { in: statuses },
      // Production safety: fictional rows are excluded at the query level, not
      // filtered afterwards, so they can never leak through a code path change.
      source: "CANONICAL" as const,
    };

    const [rows, total] = await Promise.all([
      this.delegate.findMany({
        where,
        include: { aliases: true, externalIds: true },
        orderBy: [{ key: "asc" }],
        ...(query.limit != null ? { take: query.limit } : {}),
        ...(query.offset != null ? { skip: query.offset } : {}),
      }),
      this.delegate.count({ where }),
    ]);

    // One batched evidence query for the whole page — never per entity.
    const evidenceByKey = await this.loadEvidence(rows.map((r) => r.key));

    const entities = stableOrder(
      rows.map((r) => rowToEntity(r, evidenceByKey.get(r.key) ?? [])).filter((e) => attributesMatch(e, query.attributes))
    );

    return { entities, total, source: "CANONICAL" };
  }

  async findByKey(key: string): Promise<Entity | null> {
    const row = await this.delegate.findUnique({
      where: { key },
      include: { aliases: true, externalIds: true },
    });
    if (!row) return null;
    const evidence = await this.loadEvidence([row.key]);
    return rowToEntity(row, evidence.get(row.key) ?? []);
  }
}

// ─── Fixture (tests / local demo) ─────────────────────────────────────────────

export class FixtureEntityRepository implements EntityRepository {
  readonly kind = "fixture" as const;

  constructor(private readonly corpus: Entity[]) {}

  async findCandidates(query: CandidateQuery): Promise<CandidatePage> {
    // A production caller must never be served fictional data.
    if (query.requireCanonical) return { entities: [], total: 0, source: "DEMO" };

    const matched = this.corpus.filter(
      (e) => e.categoryId === query.categoryId && attributesMatch(e, query.attributes)
    );
    const ordered = stableOrder(matched);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? ordered.length;
    return { entities: ordered.slice(offset, offset + limit), total: ordered.length, source: "DEMO" };
  }

  async findByKey(key: string): Promise<Entity | null> {
    return this.corpus.find((e) => e.id === key) ?? null;
  }
}
