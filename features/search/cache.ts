/**
 * Caching and background enrichment (Part 12).
 *
 * Three separate caches with different lifetimes, because the things they hold
 * go stale at very different rates:
 *
 *   query results     — short TTL; the answer to a specific question
 *   discovery         — medium TTL; which products exist changes slowly
 *   entity evidence   — long TTL; per-source staleness governs refresh
 *
 * Two properties matter more than the storage:
 *
 *   REQUEST DEDUPLICATION — concurrent identical requests share one in-flight
 *   promise, so a popular query does not trigger N provider calls.
 *
 *   STALE-WHILE-REVALIDATE — an expired-but-usable entry is served immediately
 *   and refreshed in the background, so a user never waits on a crawl. This is
 *   what "do not crawl every candidate synchronously on every request" means in
 *   practice.
 */

// ─── Entry ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  /** Fresh until this timestamp. */
  freshUntil: number;
  /** Servable-while-revalidating until this timestamp. */
  staleUntil: number;
}

export interface CacheStats {
  hits: number;
  staleHits: number;
  misses: number;
  dedupedWaits: number;
  size: number;
}

export interface CacheOptions {
  /** How long an entry is fresh. */
  ttlMs: number;
  /** Extra window during which a stale entry may be served while refreshing. */
  staleWhileRevalidateMs: number;
  /** Hard cap on entries; oldest are evicted first. */
  maxEntries: number;
}

export const QUERY_CACHE: CacheOptions = {
  ttlMs: 5 * 60_000,
  staleWhileRevalidateMs: 25 * 60_000,
  maxEntries: 500,
};

export const DISCOVERY_CACHE: CacheOptions = {
  ttlMs: 6 * 60 * 60_000,
  staleWhileRevalidateMs: 18 * 60 * 60_000,
  maxEntries: 200,
};

export const EVIDENCE_CACHE: CacheOptions = {
  ttlMs: 24 * 60 * 60_000,
  staleWhileRevalidateMs: 6 * 24 * 60 * 60_000,
  maxEntries: 2_000,
};

/** Per-source staleness — how long each class of evidence stays trustworthy. */
export const SOURCE_STALENESS_MS: Record<string, number> = {
  official: 7 * 24 * 60 * 60_000,
  pricing_page: 3 * 24 * 60 * 60_000,
  documentation: 14 * 24 * 60 * 60_000,
  trustpilot: 3 * 24 * 60 * 60_000,
  app_store: 3 * 24 * 60 * 60_000,
  github: 24 * 60 * 60_000,
  reddit: 7 * 24 * 60 * 60_000,
  editorial: 30 * 24 * 60 * 60_000,
};

export function isSourceStale(sourceType: string, retrievedAt: string, now: Date): boolean {
  const ttl = SOURCE_STALENESS_MS[sourceType] ?? 7 * 24 * 60 * 60_000;
  const at = new Date(retrievedAt).getTime();
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at > ttl;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

export type Revalidator<T> = () => Promise<T>;

/**
 * In-process TTL cache with request coalescing and stale-while-revalidate.
 *
 * In-process is deliberate for now: it is correct, dependency-free, and
 * testable. `SearchCache` is the seam a shared Redis implementation slots into
 * without any caller changing.
 */
export class SearchCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private stats: CacheStats = { hits: 0, staleHits: 0, misses: 0, dedupedWaits: 0, size: 0 };

  constructor(
    private readonly options: CacheOptions,
    private readonly clock: () => number = Date.now
  ) {}

  /**
   * Get-or-compute.
   *
   * - Fresh hit → returned immediately.
   * - Stale-but-servable hit → returned immediately, refresh kicked off in the
   *   background (errors swallowed; a failed refresh must not surface to the
   *   user who was served a perfectly good stale value).
   * - Miss → awaits the loader, coalescing concurrent callers onto one promise.
   */
  async get(key: string, load: Revalidator<T>): Promise<{ value: T; hit: "fresh" | "stale" | "miss" }> {
    const now = this.clock();
    const entry = this.entries.get(key);

    if (entry && now < entry.freshUntil) {
      this.stats.hits += 1;
      return { value: entry.value, hit: "fresh" };
    }

    if (entry && now < entry.staleUntil) {
      this.stats.staleHits += 1;
      this.refreshInBackground(key, load);
      return { value: entry.value, hit: "stale" };
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      this.stats.dedupedWaits += 1;
      return { value: await existing, hit: "miss" };
    }

    this.stats.misses += 1;
    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return { value: await promise, hit: "miss" };
  }

  /** Read without computing. Used by callers that must not trigger work. */
  peek(key: string): { value: T; stale: boolean } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const now = this.clock();
    if (now >= entry.staleUntil) return null;
    return { value: entry.value, stale: now >= entry.freshUntil };
  }

  set(key: string, value: T): void {
    const now = this.clock();
    this.entries.set(key, {
      value,
      storedAt: now,
      freshUntil: now + this.options.ttlMs,
      staleUntil: now + this.options.ttlMs + this.options.staleWhileRevalidateMs,
    });
    this.evictIfNeeded();
    this.stats.size = this.entries.size;
  }

  delete(key: string): void {
    this.entries.delete(key);
    this.stats.size = this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.stats = { hits: 0, staleHits: 0, misses: 0, dedupedWaits: 0, size: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.entries.size };
  }

  private refreshInBackground(key: string, load: Revalidator<T>): void {
    if (this.inFlight.has(key)) return;
    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .catch(() => {
        // A failed background refresh leaves the stale entry in place. The user
        // already has a usable answer; failing loudly here would help no one.
        return this.entries.get(key)?.value as T;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= this.options.maxEntries) return;
    const sorted = [...this.entries.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
    const excess = this.entries.size - this.options.maxEntries;
    for (let i = 0; i < excess; i++) this.entries.delete(sorted[i][0]);
  }
}

// ─── Keys ────────────────────────────────────────────────────────────────────

/** Normalize a query so trivially-different phrasings share a cache entry. */
export function queryCacheKey(input: {
  query: string;
  categoryId?: string | null;
  limit?: number;
  cursor?: string | null;
}): string {
  const q = input.query.toLowerCase().replace(/\s+/g, " ").trim();
  return [
    `q=${q}`,
    `c=${input.categoryId ?? ""}`,
    `n=${input.limit ?? ""}`,
    `p=${input.cursor ?? ""}`,
  ].join("|");
}

export function discoveryCacheKey(categoryId: string, rawQuery: string): string {
  // Discovery is category-scoped; the query only shapes the search phrasing, so
  // a coarse token signature is enough and keeps the hit rate high.
  const tokens = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .sort()
    .slice(0, 5)
    .join(".");
  return `disc:${categoryId}:${tokens}`;
}

export function evidenceCacheKey(entityId: string): string {
  return `ev:${entityId}`;
}

// ─── Background enrichment ───────────────────────────────────────────────────

export interface EnrichmentTask {
  entityId: string;
  reason: "missing" | "stale";
  queuedAt: number;
}

/**
 * Queue of entities that need evidence refreshed.
 *
 * The user request ENQUEUES and returns; it never waits. A worker (the existing
 * scheduled ingestion job) drains the queue. This is the mechanism that keeps
 * "gather evidence for 30 candidates" off the request path.
 */
export class EnrichmentQueue {
  private readonly queued = new Map<string, EnrichmentTask>();

  constructor(private readonly maxSize = 500) {}

  enqueue(entityId: string, reason: EnrichmentTask["reason"], now: number = Date.now()): void {
    if (this.queued.has(entityId)) return;
    if (this.queued.size >= this.maxSize) return;
    this.queued.set(entityId, { entityId, reason, queuedAt: now });
  }

  /** Take up to `limit` tasks, oldest first. */
  drain(limit = 25): EnrichmentTask[] {
    const tasks = [...this.queued.values()].sort((a, b) => a.queuedAt - b.queuedAt).slice(0, limit);
    for (const t of tasks) this.queued.delete(t.entityId);
    return tasks;
  }

  get size(): number {
    return this.queued.size;
  }

  clear(): void {
    this.queued.clear();
  }
}

// ─── Popular-query precomputation ────────────────────────────────────────────

/**
 * Tracks query frequency so a warmer can precompute the common ones. Counts
 * only; it stores no user identity and no per-user history.
 */
export class QueryPopularity {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxTracked = 1_000) {}

  record(query: string): void {
    const key = query.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) return;
    if (!this.counts.has(key) && this.counts.size >= this.maxTracked) return;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** The most-requested queries, for a warming pass. */
  top(n = 20): { query: string; count: number }[] {
    return [...this.counts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query))
      .slice(0, n);
  }

  clear(): void {
    this.counts.clear();
  }
}
