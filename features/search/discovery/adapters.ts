/**
 * Discovery adapters — the concrete layers.
 *
 * Layer 1 (canonical) and layer 2 (web-search) are the load-bearing pair:
 * canonical gives us what we already trust, web-search gives us breadth. Layers
 * 3–5 are structural — they exist so a category provider or an approved
 * directory can be registered without touching any other code — and layer 6
 * lives in ./agentic.ts.
 *
 * No adapter may promote anything to canonical. Every one of them emits
 * DiscoveredCandidate, which is explicitly an untrusted mention.
 */

import type { EntityRepository } from "@/features/entities/repository";
import { issue } from "../contracts";
import type { WebSearchProvider } from "../providers/types";
import { providerIssue } from "../providers/types";
import type { SearchBudget } from "../providers/registry";
import {
  candidate,
  emptyOutcome,
  type CandidateDiscoveryAdapter,
  type DiscoveredCandidate,
  type DiscoveryAdapterOutcome,
  type DiscoveryContext,
} from "./types";
import { dedupeByDomain, normalizeDiscoveredUrl, productNameFromTitle } from "./url";

// ─── Layer 1: canonical database entities ────────────────────────────────────

export class CanonicalDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "canonical";
  readonly layer = "canonical" as const;

  constructor(
    private readonly repo: EntityRepository,
    private readonly requireCanonical = true
  ) {}

  supports(): boolean {
    return true;
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    try {
      const page = await this.repo.findCandidates({
        categoryId: context.categoryId,
        requireCanonical: this.requireCanonical,
      });

      const candidates = page.entities.map((e) =>
        candidate({
          name: e.canonicalName,
          candidateUrl: e.officialDomain,
          sourceUrl: e.officialDomain,
          sourceAdapter: this.id,
          layer: this.layer,
          snippet: e.description || null,
          categoryHints: [e.categoryId],
          externalIds: e.externalIds.map((x) => ({ system: x.sourceType, id: x.externalId })),
          // We curated this row, so identity is certain. Still not a quality claim.
          discoveryConfidence: 1,
          discoveredAt: context.now.toISOString(),
        })
      );

      return { ...emptyOutcome(), candidates };
    } catch (err) {
      return {
        ...emptyOutcome(),
        issues: [
          issue(
            "discover",
            "source_unavailable",
            `Canonical lookup failed: ${err instanceof Error ? err.name : "unknown"}`,
            this.id
          ),
        ],
      };
    }
  }
}

// ─── Layer 2: structured search-provider results ─────────────────────────────

/**
 * Query templates. Each is a DIFFERENT ANGLE on the same need, because a single
 * phrasing returns a single slice of the index — breadth comes from asking
 * several ways, not from asking once and paging deeper.
 */
export function buildDiscoveryQueries(categoryName: string, rawQuery: string): string[] {
  const cat = categoryName.toLowerCase();
  return [
    `best ${cat} ${stripFiller(rawQuery)}`.trim(),
    `${cat} alternatives comparison`,
    `top ${cat} for small teams`,
  ];
}

function stripFiller(q: string): string {
  return q
    .toLowerCase()
    .replace(/\b(best|good|cheap|find|me|my|i|need|want|looking for|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export class WebSearchDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "web-search";
  readonly layer = "web-search" as const;

  constructor(
    private readonly provider: WebSearchProvider | null,
    private readonly budget: SearchBudget
  ) {}

  supports(): boolean {
    return this.provider !== null && this.provider.isConfigured();
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    const provider = this.provider;
    if (!provider) {
      return {
        ...emptyOutcome(),
        issues: [
          issue("discover", "source_unavailable", "No web search provider is configured.", this.id),
        ],
      };
    }

    const out: DiscoveryAdapterOutcome = { ...emptyOutcome() };
    const queries = buildDiscoveryQueries(context.categoryName, context.rawQuery);
    const collected: { title: string; url: string; snippet: string; position: number }[] = [];

    for (const q of queries) {
      if (!this.budget.canSpend()) {
        out.issues.push(
          issue("discover", "budget_exhausted", "Search budget exhausted before all queries ran.", this.id)
        );
        break;
      }
      if (context.signal?.aborted) break;

      const outcome = await provider.search({ q, count: 20 }, context.signal);
      this.budget.record(outcome.requestCount, provider.costPerRequestUsd, outcome.durationMs);
      out.externalCalls += outcome.requestCount;
      out.costUsd += outcome.requestCount * provider.costPerRequestUsd;
      out.queriesIssued.push(q);

      if (!outcome.ok) {
        out.issues.push(providerIssue(outcome.error, provider.id));
        // An unauthorized/quota error will fail identically for every remaining
        // query — stop rather than burning the budget confirming it.
        if (!outcome.error.retryable) break;
        continue;
      }

      collected.push(...outcome.results);
    }

    // One candidate per registrable domain, best position wins.
    const deduped = dedupeByDomain(collected);

    for (const r of deduped) {
      const norm = normalizeDiscoveredUrl(r.url);
      if (!norm || norm.isJunk) continue;

      // An aggregator page is a MENTION SOURCE, not a product. We keep the
      // signal that it discussed this category, but we do not manufacture a
      // candidate from a listicle's own domain.
      if (norm.isAggregator) continue;

      out.candidates.push(
        candidate({
          name: productNameFromTitle(r.title, norm.host),
          candidateUrl: `https://${norm.host}`,
          sourceUrl: r.url,
          sourceAdapter: this.id,
          layer: this.layer,
          snippet: r.snippet || null,
          categoryHints: [context.categoryId],
          // Position-derived: earlier results are more likely to be the product
          // itself. Identity confidence only — says nothing about quality.
          discoveryConfidence: positionConfidence(r.position),
          discoveredAt: context.now.toISOString(),
        })
      );
    }

    return out;
  }
}

/** Map a provider rank to 0.4..0.85 identity confidence. Never above 0.85. */
function positionConfidence(position: number): number {
  const c = 0.85 - Math.min(position, 20) * 0.02;
  return Math.max(0.4, Math.round(c * 100) / 100);
}

// ─── Layer 3: category-specific providers ────────────────────────────────────

/**
 * A category-scoped source (a package registry for dev tools, an app store for
 * mobile, and so on). None is registered yet — registering one is the only
 * change needed, and nothing downstream is aware it happened.
 */
export interface CategoryProvider {
  readonly id: string;
  readonly categoryIds: string[];
  fetch(context: DiscoveryContext): Promise<DiscoveredCandidate[]>;
}

export class CategoryDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "category";
  readonly layer = "category" as const;

  constructor(private readonly providers: CategoryProvider[] = []) {}

  supports(context: DiscoveryContext): boolean {
    return this.providers.some((p) => p.categoryIds.includes(context.categoryId));
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    const applicable = this.providers.filter((p) => p.categoryIds.includes(context.categoryId));
    const out: DiscoveryAdapterOutcome = { ...emptyOutcome() };

    await Promise.all(
      applicable.map(async (p) => {
        try {
          out.candidates.push(...(await p.fetch(context)));
          out.externalCalls += 1;
        } catch (err) {
          out.issues.push(
            issue(
              "discover",
              "source_unavailable",
              `Category provider failed: ${err instanceof Error ? err.name : "unknown"}`,
              p.id
            )
          );
        }
      })
    );

    return out;
  }
}

// ─── Layer 4: curated directories ────────────────────────────────────────────

/**
 * An explicitly APPROVED directory. The allowlist is the point: a directory
 * must be permitted (terms reviewed, attribution honored) before it can be
 * registered, so this adapter carries no default entries.
 */
export interface ApprovedDirectory {
  readonly id: string;
  readonly label: string;
  readonly categoryIds: string[];
  fetch(context: DiscoveryContext): Promise<DiscoveredCandidate[]>;
}

export class DirectoryDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "directory";
  readonly layer = "directory" as const;

  constructor(private readonly directories: ApprovedDirectory[] = []) {}

  supports(context: DiscoveryContext): boolean {
    return this.directories.some((d) => d.categoryIds.includes(context.categoryId));
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    const applicable = this.directories.filter((d) => d.categoryIds.includes(context.categoryId));
    const out: DiscoveryAdapterOutcome = { ...emptyOutcome() };

    await Promise.all(
      applicable.map(async (d) => {
        try {
          out.candidates.push(...(await d.fetch(context)));
          out.externalCalls += 1;
        } catch (err) {
          out.issues.push(
            issue(
              "discover",
              "source_unavailable",
              `Directory failed: ${err instanceof Error ? err.name : "unknown"}`,
              d.id
            )
          );
        }
      })
    );

    return out;
  }
}

// ─── Layer 5: official-site discovery ────────────────────────────────────────

/**
 * Confirms a candidate's OFFICIAL domain via a site-scoped provider query.
 *
 * This does not find new products — it upgrades identity confidence for
 * products we already have a name for but no verified URL, which is what makes
 * the resolution ladder's "verified canonical domain" rung usable.
 */
export class OfficialSiteDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "official-site";
  readonly layer = "official-site" as const;

  constructor(
    private readonly provider: WebSearchProvider | null,
    private readonly budget: SearchBudget,
    /** Names needing a URL. Supplied by the runner from earlier layers. */
    private readonly unresolvedNames: () => string[]
  ) {}

  supports(): boolean {
    return this.provider !== null && this.provider.isConfigured() && this.unresolvedNames().length > 0;
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    const provider = this.provider;
    const out: DiscoveryAdapterOutcome = { ...emptyOutcome() };
    if (!provider) return out;

    // Bounded: only a handful of confirmations per request.
    for (const name of this.unresolvedNames().slice(0, 3)) {
      if (!this.budget.canSpend() || context.signal?.aborted) break;

      const q = `${name} ${context.categoryName} official site`;
      const outcome = await provider.search({ q, count: 3 }, context.signal);
      this.budget.record(outcome.requestCount, provider.costPerRequestUsd, outcome.durationMs);
      out.externalCalls += outcome.requestCount;
      out.costUsd += outcome.requestCount * provider.costPerRequestUsd;
      out.queriesIssued.push(q);

      if (!outcome.ok) {
        out.issues.push(providerIssue(outcome.error, provider.id));
        if (!outcome.error.retryable) break;
        continue;
      }

      const top = outcome.results.find((r) => {
        const n = normalizeDiscoveredUrl(r.url);
        return n && !n.isAggregator && !n.isJunk;
      });
      if (!top) continue;

      const norm = normalizeDiscoveredUrl(top.url)!;
      out.candidates.push(
        candidate({
          name,
          candidateUrl: `https://${norm.host}`,
          sourceUrl: top.url,
          sourceAdapter: this.id,
          layer: this.layer,
          snippet: top.snippet || null,
          categoryHints: [context.categoryId],
          // A targeted, name-scoped confirmation is stronger than a generic hit,
          // but still short of the certainty a curated row carries.
          discoveryConfidence: 0.75,
          discoveredAt: context.now.toISOString(),
        })
      );
    }

    return out;
  }
}
