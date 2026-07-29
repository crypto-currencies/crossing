/**
 * Stages 3–5: `discover`, `normalize`, `resolveEntities`.
 *
 * `discover` is the stage the audit found MISSING entirely
 * (docs/live-search-architecture.md §1.4): today's engine only ever looks up a
 * hand-authored list, which is why coverage is 2 entities. This stage fans out
 * across every registered discovery source, in parallel, under a deadline, and
 * unions their leads.
 *
 * Adding breadth later means registering another DiscoverySource — no change to
 * normalize, dedup, evidence, filtering, or ranking.
 */

import type { Entity } from "@/features/recommendation/entities/types";
import { normalizeAlias, normalizeDomainKey } from "@/features/recommendation/entities/normalize";
import type { EntityRepository } from "@/features/entities/repository";
import {
  issue,
  nowMs,
  pureResult,
  type CandidateLead,
  type NormalizedCandidate,
  type ResolvedCandidate,
  type SearchContext,
  type Stage,
  type StageIssue,
  type StageResult,
} from "../contracts";
import type { DiscoverySource } from "../sources/types";

// ─── Stage 3: discover ───────────────────────────────────────────────────────

export interface DiscoverInput {
  categoryId: string;
  rawQuery: string;
  /** How many results the request wants — sources are asked for a wider net. */
  targetCount: number;
}

export interface DiscoverOutput {
  leads: CandidateLead[];
  /** Lead count per source id, for the trace. */
  bySource: Record<string, number>;
}

/**
 * Over-fetch factor. Discovery casts a wider net than the target list size
 * because dedup, hard constraints, and evidence gaps all shrink the pool
 * downstream. Aiming for exactly N here reliably yields fewer than N.
 */
export const DISCOVERY_OVERFETCH = 3;

export class DiscoverStage implements Stage<DiscoverInput, DiscoverOutput> {
  readonly name = "discover" as const;

  constructor(private readonly sources: DiscoverySource[]) {}

  async run(input: DiscoverInput, ctx: SearchContext): Promise<StageResult<DiscoverOutput>> {
    const started = nowMs();
    const issues: StageIssue[] = [];
    const bySource: Record<string, number> = {};
    let externalCalls = 0;

    const available = this.sources.filter((s) => s.isAvailable(ctx));
    if (available.length === 0) {
      issues.push(issue("discover", "source_unavailable", "No discovery source is configured."));
    }

    const limit = input.targetCount * DISCOVERY_OVERFETCH;

    // Sources run in PARALLEL and are individually fault-isolated: one slow or
    // broken source degrades breadth, it never fails the search.
    const outcomes = await Promise.all(
      available.map(async (source) => {
        try {
          return {
            id: source.descriptor.id,
            outcome: await source.discover(
              { categoryId: input.categoryId, rawQuery: input.rawQuery, limit },
              ctx
            ),
          };
        } catch (err) {
          return {
            id: source.descriptor.id,
            outcome: {
              leads: [],
              issues: [
                issue(
                  "discover",
                  "source_unavailable",
                  `Source threw: ${err instanceof Error ? err.name : "unknown error"}`,
                  source.descriptor.id
                ),
              ],
              externalCalls: 0,
            },
          };
        }
      })
    );

    const leads: CandidateLead[] = [];
    for (const { id, outcome } of outcomes) {
      leads.push(...outcome.leads);
      bySource[id] = outcome.leads.length;
      issues.push(...outcome.issues);
      externalCalls += outcome.externalCalls;
    }

    return {
      output: { leads, bySource },
      issues,
      metrics: {
        stage: this.name,
        durationMs: round(nowMs() - started),
        itemsIn: available.length,
        itemsOut: leads.length,
        externalCalls,
      },
    };
  }
}

// ─── Stage 4: normalize ──────────────────────────────────────────────────────

/**
 * Clean raw leads into a comparable shape. Pure and deterministic: lowercase
 * the name, derive a registrable-domain key from the URL, and drop leads that
 * are too degenerate to identify. Nothing is invented — a lead with no usable
 * URL keeps `domainKey: null` and is matched by name alone downstream.
 */
export class NormalizeStage implements Stage<CandidateLead[], NormalizedCandidate[]> {
  readonly name = "normalize" as const;

  async run(input: CandidateLead[], ctx: SearchContext): Promise<StageResult<NormalizedCandidate[]>> {
    const started = nowMs();
    const issues: StageIssue[] = [];
    const out: NormalizedCandidate[] = [];

    for (const lead of input) {
      const normalizedName = normalizeAlias(lead.rawName);
      if (!normalizedName) {
        issues.push(issue("normalize", "validation_failed", "Lead has no usable name.", lead.sourceId));
        continue;
      }

      let domainKey: string | null = null;
      if (lead.url) {
        try {
          domainKey = normalizeDomainKey(lead.url);
        } catch {
          // An unparseable URL is a data-quality problem, not a fatal one — keep
          // the lead and let name matching try.
          issues.push(
            issue("normalize", "partial_data", `Unparseable URL for "${lead.rawName}".`, lead.sourceId)
          );
        }
      }

      out.push({ ...lead, normalizedName, domainKey });
    }

    void ctx;
    return pureResult(this.name, out, started, { in: input.length, out: out.length }, issues);
  }
}

// ─── Stage 5: resolveEntities ────────────────────────────────────────────────

export interface ResolveEntitiesInput {
  candidates: NormalizedCandidate[];
  categoryId: string;
}

/**
 * Collapse leads into canonical entities.
 *
 * Dedup key precedence: normalized domain key first (strongest identity
 * signal), then normalized name. Two leads from different sources pointing at
 * the same domain are ONE entity that two sources corroborate — and
 * `distinctSources` records that corroboration, which is a genuine
 * independent-agreement signal rather than a fabricated one.
 *
 * Entities are hydrated from the catalog repository. A lead that resolves to no
 * catalog entity is dropped here rather than being ranked on a bare name: we
 * will not rank something we know nothing about.
 */
export class ResolveEntitiesStage implements Stage<ResolveEntitiesInput, ResolvedCandidate[]> {
  readonly name = "resolveEntities" as const;

  /**
   * `requireCanonical` defaults to true: a production caller must never be
   * served fictional rows, and `FixtureEntityRepository` enforces that by
   * returning nothing when it is set. Tests and local previews pass `false`
   * explicitly to opt into the demo corpus — the choice belongs to the
   * deployment, not to this stage.
   */
  constructor(
    private readonly repo: EntityRepository,
    private readonly requireCanonical = true
  ) {}

  async run(input: ResolveEntitiesInput, ctx: SearchContext): Promise<StageResult<ResolvedCandidate[]>> {
    const started = nowMs();
    const issues: StageIssue[] = [];

    // Group leads by identity.
    const groups = new Map<string, NormalizedCandidate[]>();
    for (const c of input.candidates) {
      const key = c.domainKey ?? `name:${c.normalizedName}`;
      const existing = groups.get(key);
      if (existing) existing.push(c);
      else groups.set(key, [c]);
    }

    // Hydrate each group into a catalog entity.
    const catalog = await this.loadCatalog(input.categoryId);
    const byDomainKey = new Map(catalog.map((e) => [e.domainKey, e]));
    const byName = new Map(catalog.map((e) => [normalizeAlias(e.canonicalName), e]));
    for (const e of catalog) {
      for (const alias of e.aliases) byName.set(normalizeAlias(alias), e);
    }

    const resolved: ResolvedCandidate[] = [];
    for (const [key, leads] of groups) {
      const first = leads[0];
      const entity =
        (first.domainKey ? byDomainKey.get(first.domainKey) : undefined) ??
        byName.get(first.normalizedName);

      if (!entity) {
        // Known unknown: a source named something the catalog does not carry.
        // Recorded so coverage can report it, never ranked on faith.
        issues.push(
          issue("resolveEntities", "partial_data", `No catalog entity for "${first.rawName}".`, key)
        );
        continue;
      }

      // Defense-in-depth: retrieval must never cross a category boundary.
      if (entity.categoryId !== input.categoryId) {
        issues.push(
          issue(
            "resolveEntities",
            "validation_failed",
            `Dropped "${entity.canonicalName}" — belongs to ${entity.categoryId}, not ${input.categoryId}.`,
            entity.id
          )
        );
        continue;
      }

      resolved.push({
        entity,
        leads,
        distinctSources: new Set(leads.map((l) => l.sourceId)).size,
      });
    }

    // A second pass merges any two groups that resolved to the SAME entity —
    // e.g. one lead matched by domain and another by name.
    const merged = mergeByEntityId(resolved);

    void ctx;
    return pureResult(
      this.name,
      merged,
      started,
      { in: input.candidates.length, out: merged.length },
      issues
    );
  }

  private async loadCatalog(categoryId: string): Promise<Entity[]> {
    const page = await this.repo.findCandidates({
      categoryId,
      requireCanonical: this.requireCanonical,
    });
    return page.entities;
  }
}

/** Union groups that resolved to the same canonical entity. */
function mergeByEntityId(candidates: ResolvedCandidate[]): ResolvedCandidate[] {
  const byId = new Map<string, ResolvedCandidate>();
  for (const c of candidates) {
    const existing = byId.get(c.entity.id);
    if (!existing) {
      byId.set(c.entity.id, c);
      continue;
    }
    const leads = [...existing.leads, ...c.leads];
    byId.set(c.entity.id, {
      entity: existing.entity,
      leads,
      distinctSources: new Set(leads.map((l) => l.sourceId)).size,
    });
  }
  // Deterministic order before ranking, so ties never flap between runs.
  return Array.from(byId.values()).sort((a, b) => a.entity.id.localeCompare(b.entity.id));
}

function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}
