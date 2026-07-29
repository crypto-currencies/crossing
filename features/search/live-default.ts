/**
 * Production wiring for the live search pipeline.
 *
 * Assembles the discovery layers, the configured search provider, the evidence
 * sources, and the caches. Layers whose dependencies are absent are simply not
 * registered — a missing search-provider key means the web-search, official-site,
 * and agentic layers do not exist for that deployment, and the pipeline reports
 * reduced coverage rather than inventing anything.
 *
 * Demo mode (`SEARCH_DEMO_MODE=on`, non-production only) is the ONLY way to use
 * the fixture corpus. Part 13 forbids it in production, and `buildLiveSearch`
 * refuses to honor it there.
 */

import { db } from "@/lib/db";
import { createDefaultEvidenceLoader } from "@/features/entities/evidence-loader";
import {
  FixtureEntityRepository,
  PrismaEntityRepository,
  type EntityDelegate,
  type EntityRepository,
} from "@/features/entities/repository";
import { buildFixtures } from "@/features/recommendation/fixtures";

import { LiveSearchOrchestrator, type LiveOrchestratorDeps } from "./live-orchestrator";
import {
  CanonicalDiscoveryAdapter,
  CategoryDiscoveryAdapter,
  DirectoryDiscoveryAdapter,
  OfficialSiteDiscoveryAdapter,
  WebSearchDiscoveryAdapter,
} from "./discovery/adapters";
import { AgenticDiscoveryAdapter, agenticLimitsFromEnv } from "./discovery/agentic";
import type { CandidateDiscoveryAdapter } from "./discovery/types";
import { BatchedOfficialSiteEvidenceSource } from "./sources/official-site";
import { ReviewEvidenceSource, buildReviewService } from "./reviews/default";
import type { Entity } from "@/features/recommendation/entities/types";
import { SearchBudget, budgetFromEnv, resolveProvider, configuredProviderIds } from "./providers/registry";
import { DISCOVERY_CACHE, EnrichmentQueue, QueryPopularity, SearchCache } from "./cache";
import type { LayeredDiscoveryResult } from "./discovery/runner";

export interface BuildOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

/** Whether explicit demo mode is on. Never true in production. */
export function isDemoMode(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV !== "production" && env.SEARCH_DEMO_MODE === "on";
}

/** What this deployment can actually do — for admin/health surfaces. */
export interface SearchCapabilities {
  provider: string | null;
  configuredProviders: string[];
  layers: string[];
  demoMode: boolean;
  liveDiscoveryAvailable: boolean;
}

export function searchCapabilities(env: NodeJS.ProcessEnv = process.env): SearchCapabilities {
  const provider = resolveProvider({ env });
  const demoMode = isDemoMode(env);
  const layers = ["canonical"];
  if (provider) layers.push("web-search", "official-site", "agentic");
  return {
    provider: provider?.id ?? null,
    configuredProviders: configuredProviderIds({ env }),
    layers,
    demoMode,
    // The canonical layer alone counts as live: it is real curated data, not fiction.
    liveDiscoveryAvailable: true,
  };
}

let _orchestrator: LiveSearchOrchestrator | null = null;

export function buildLiveSearch(options: BuildOptions = {}): LiveSearchOrchestrator {
  const env = options.env ?? process.env;
  const isProd = env.NODE_ENV === "production";
  const demo = isDemoMode(env);

  // ── Repository ──────────────────────────────────────────────────────────
  let repo: EntityRepository;
  if (demo) {
    // Explicit, non-production demo mode only.
    repo = new FixtureEntityRepository(buildFixtures(new Date()));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = new PrismaEntityRepository((db as any).entity as EntityDelegate, createDefaultEvidenceLoader());
  }

  // ── Provider + budget ───────────────────────────────────────────────────
  const provider = resolveProvider({ env, fetchImpl: options.fetchImpl });
  const budget = new SearchBudget(budgetFromEnv(env));

  // ── Discovery layers ────────────────────────────────────────────────────
  const discovered: string[] = [];
  const adapters: CandidateDiscoveryAdapter[] = [
    new CanonicalDiscoveryAdapter(repo, !demo),
  ];

  if (provider) {
    adapters.push(new WebSearchDiscoveryAdapter(provider, budget));
    // Layers 3 and 4 have no approved providers/directories registered yet;
    // they are present so registering one requires no other change.
    adapters.push(new CategoryDiscoveryAdapter([]));
    adapters.push(new DirectoryDiscoveryAdapter([]));
    adapters.push(new OfficialSiteDiscoveryAdapter(provider, budget, () => discovered));
    if (env.SEARCH_AGENT_ENABLED === "on") {
      adapters.push(
        new AgenticDiscoveryAdapter(provider, budget, agenticLimitsFromEnv(env), undefined, () => discovered)
      );
    }
  }

  // ── Evidence sources ────────────────────────────────────────────────────
  // Two classes, deliberately separate: the official-site source supplies FACTS
  // (vendor, ratings stripped), the review source supplies REPUTATION
  // (independent, ratings permitted). Neither can do the other's job.
  //
  // The review source is registered even without credentials — it then reports
  // `missing-credentials`, so the pipeline can tell an owner what to configure
  // instead of silently having no reputation coverage.
  const entityCache = new Map<string, Entity>();
  const reviewSource = new ReviewEvidenceSource(
    buildReviewService({ env, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) }),
    () => entityCache
  );

  const deps: LiveOrchestratorDeps = {
    repo,
    discoveryAdapters: adapters,
    evidenceSources: demo
      ? []
      : [new BatchedOfficialSiteEvidenceSource(createDefaultEvidenceLoader()), reviewSource],
    entityCache,
    availabilityProbe: async (categoryId) => {
      const page = await repo.findCandidates({ categoryId, requireCanonical: !demo, limit: 1 });
      return page.total;
    },
    env,
    requireCanonical: !demo,
    // Production must never silently serve fixtures.
    requireLiveDiscovery: isProd,
    discoveryCache: new SearchCache<LayeredDiscoveryResult>(DISCOVERY_CACHE),
    enrichmentQueue: new EnrichmentQueue(),
    popularity: new QueryPopularity(),
  };

  return new LiveSearchOrchestrator(deps);
}

/** Memoized production orchestrator. */
export function getLiveSearch(): LiveSearchOrchestrator {
  if (!_orchestrator) _orchestrator = buildLiveSearch();
  return _orchestrator;
}

/** Test seam. */
export function setLiveSearch(orchestrator: LiveSearchOrchestrator | null): void {
  _orchestrator = orchestrator;
}
