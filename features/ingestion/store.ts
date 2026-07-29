/**
 * Snapshot persistence.
 *
 * Append-only: history is never overwritten. Two implementations ship:
 *   - InMemorySnapshotStore — default, used by tests and by the current
 *     fixture-based engine (no DB dependency).
 *   - FileSnapshotStore — JSON-lines per entity under a data dir, for local dev
 *     persistence across restarts.
 *
 * The production path is a Prisma `EvidenceSnapshot` table implementing this same
 * interface (see docs/ingestion.md → "Snapshot retention"); it is intentionally
 * NOT wired in this phase to avoid coupling the fixture engine to Postgres.
 */

import type { EvidenceSnapshot } from "./snapshot";
import { PrismaSnapshotStore } from "./prisma-store";

export interface SnapshotStore {
  /** Append a new immutable snapshot. */
  append(snapshot: EvidenceSnapshot): Promise<void>;
  /** Newest snapshot for an entity (ok or not), or null. */
  latest(entityId: string): Promise<EvidenceSnapshot | null>;
  /** Newest *successful* snapshot for an entity, or null. */
  latestValid(entityId: string): Promise<EvidenceSnapshot | null>;
  /** Snapshot history for an entity, newest first. */
  history(entityId: string, limit?: number): Promise<EvidenceSnapshot[]>;
  /** Latest snapshot per entity across the whole store. */
  allLatest(): Promise<Map<string, EvidenceSnapshot>>;
}

function byNewest(a: EvidenceSnapshot, b: EvidenceSnapshot): number {
  return new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime();
}

export class InMemorySnapshotStore implements SnapshotStore {
  private byEntity = new Map<string, EvidenceSnapshot[]>();

  async append(snapshot: EvidenceSnapshot): Promise<void> {
    const list = this.byEntity.get(snapshot.entityId) ?? [];
    list.push(snapshot);
    this.byEntity.set(snapshot.entityId, list);
  }

  async latest(entityId: string): Promise<EvidenceSnapshot | null> {
    const list = [...(this.byEntity.get(entityId) ?? [])].sort(byNewest);
    return list[0] ?? null;
  }

  async latestValid(entityId: string): Promise<EvidenceSnapshot | null> {
    const list = [...(this.byEntity.get(entityId) ?? [])].filter((s) => s.ok).sort(byNewest);
    return list[0] ?? null;
  }

  async history(entityId: string, limit = 20): Promise<EvidenceSnapshot[]> {
    return [...(this.byEntity.get(entityId) ?? [])].sort(byNewest).slice(0, limit);
  }

  async allLatest(): Promise<Map<string, EvidenceSnapshot>> {
    const out = new Map<string, EvidenceSnapshot>();
    for (const [id, list] of this.byEntity) {
      const newest = [...list].sort(byNewest)[0];
      if (newest) out.set(id, newest);
    }
    return out;
  }
}

/**
 * Filesystem JSON-lines store for local dev. One append-only file per entity:
 * `<dir>/<entityId>.jsonl`. Never rewrites existing lines.
 */
export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly dir: string) {}

  private async fs() {
    return import("node:fs/promises");
  }
  private async pathMod() {
    return import("node:path");
  }
  private async fileFor(entityId: string): Promise<string> {
    const path = await this.pathMod();
    // entityId is a controlled slug from the registry; still sanitize defensively.
    const safe = entityId.replace(/[^a-z0-9_-]/gi, "_");
    return path.join(this.dir, `${safe}.jsonl`);
  }

  async append(snapshot: EvidenceSnapshot): Promise<void> {
    const fs = await this.fs();
    await fs.mkdir(this.dir, { recursive: true });
    const file = await this.fileFor(snapshot.entityId);
    await fs.appendFile(file, JSON.stringify(snapshot) + "\n", "utf8");
  }

  private async readAll(entityId: string): Promise<EvidenceSnapshot[]> {
    const fs = await this.fs();
    const file = await this.fileFor(entityId);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch {
      return [];
    }
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EvidenceSnapshot;
        } catch {
          return null;
        }
      })
      .filter((s): s is EvidenceSnapshot => s !== null);
  }

  async latest(entityId: string): Promise<EvidenceSnapshot | null> {
    return (await this.readAll(entityId)).sort(byNewest)[0] ?? null;
  }

  async latestValid(entityId: string): Promise<EvidenceSnapshot | null> {
    return (await this.readAll(entityId)).filter((s) => s.ok).sort(byNewest)[0] ?? null;
  }

  async history(entityId: string, limit = 20): Promise<EvidenceSnapshot[]> {
    return (await this.readAll(entityId)).sort(byNewest).slice(0, limit);
  }

  async allLatest(): Promise<Map<string, EvidenceSnapshot>> {
    const fs = await this.fs();
    const path = await this.pathMod();
    const out = new Map<string, EvidenceSnapshot>();
    let files: string[];
    try {
      files = await fs.readdir(this.dir);
    } catch {
      return out;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const entityId = path.basename(f, ".jsonl");
      const latest = await this.latest(entityId);
      if (latest) out.set(latest.entityId, latest);
    }
    return out;
  }
}

// ─── Default store selection ──────────────────────────────────────────────────

let _default: SnapshotStore | null = null;

export type StoreKind = "memory" | "file" | "prisma";

/**
 * Explicit store selection:
 *   - INGESTION_STORE=memory|file|prisma always wins.
 *   - Production defaults to `prisma` (the DB is expected — no silent fallback).
 *   - Development defaults to `file` (persists across dev-server restarts).
 */
export function resolveStoreKind(env: NodeJS.ProcessEnv = process.env): StoreKind {
  const explicit = env.INGESTION_STORE;
  if (explicit === "memory" || explicit === "file" || explicit === "prisma") return explicit;
  return env.NODE_ENV === "production" ? "prisma" : "file";
}

/**
 * The process-wide default store. Tests construct their own store and never
 * touch this. In production, `prisma` is required — this throws rather than
 * silently degrading to filesystem persistence when the DB is expected.
 */
export function getDefaultSnapshotStore(): SnapshotStore {
  if (_default) return _default;
  const kind = resolveStoreKind();
  if (kind === "memory") {
    _default = new InMemorySnapshotStore();
  } else if (kind === "file") {
    _default = new FileSnapshotStore(".data/ingestion");
  } else {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "[ingestion] snapshot store 'prisma' selected but DATABASE_URL is not set. " +
          "Set DATABASE_URL, or INGESTION_STORE=file|memory."
      );
    }
    _default = new PrismaSnapshotStore();
  }
  return _default;
}

/** Test seam: override the default store. */
export function setDefaultSnapshotStore(store: SnapshotStore | null): void {
  _default = store;
}
