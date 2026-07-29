/**
 * Layer 6: bounded agentic discovery fallback.
 *
 * Runs ONLY when earlier layers leave the candidate pool short. Its job is to
 * think of QUERIES the templates missed — "what class of product am I not
 * seeing?" — and then hand those queries to the same approved search provider
 * every other adapter uses.
 *
 * What makes it safe is that it is a QUERY GENERATOR, not a fact source:
 *
 *   - Every candidate it yields comes from a provider result, never from the
 *     model's own memory. A model-named product with no search hit is discarded.
 *   - It cannot rank, score, declare a winner, or touch canonical entities.
 *   - It cannot reach any source the other adapters cannot.
 *   - Every limit below is enforced by the LOOP, not by prompt instructions —
 *     a model that ignores its instructions still cannot exceed them.
 */

import { issue } from "../contracts";
import type { WebSearchProvider } from "../providers/types";
import { providerIssue } from "../providers/types";
import type { SearchBudget } from "../providers/registry";
import {
  candidate,
  emptyOutcome,
  type CandidateDiscoveryAdapter,
  type DiscoveryAdapterOutcome,
  type DiscoveryContext,
} from "./types";
import { dedupeByDomain, normalizeDiscoveredUrl, productNameFromTitle } from "./url";

// ─── Hard limits ─────────────────────────────────────────────────────────────

export interface AgenticLimits {
  maxIterations: number;
  maxQueries: number;
  maxCandidateUrls: number;
  maxEvidenceRequests: number;
  maxDurationMs: number;
  maxCostUsd: number;
}

export const DEFAULT_AGENTIC_LIMITS: AgenticLimits = {
  maxIterations: 2,
  maxQueries: 4,
  maxCandidateUrls: 25,
  maxEvidenceRequests: 0, // the agent does not gather evidence; that stage owns it
  maxDurationMs: 4_000,
  maxCostUsd: 0.02,
};

export function agenticLimitsFromEnv(env: NodeJS.ProcessEnv): AgenticLimits {
  const num = (raw: string | undefined, d: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    maxIterations: num(env.SEARCH_AGENT_MAX_ITERATIONS, DEFAULT_AGENTIC_LIMITS.maxIterations),
    maxQueries: num(env.SEARCH_AGENT_MAX_QUERIES, DEFAULT_AGENTIC_LIMITS.maxQueries),
    maxCandidateUrls: num(env.SEARCH_AGENT_MAX_URLS, DEFAULT_AGENTIC_LIMITS.maxCandidateUrls),
    maxEvidenceRequests: num(env.SEARCH_AGENT_MAX_EVIDENCE, DEFAULT_AGENTIC_LIMITS.maxEvidenceRequests),
    maxDurationMs: num(env.SEARCH_AGENT_MAX_MS, DEFAULT_AGENTIC_LIMITS.maxDurationMs),
    maxCostUsd: num(env.SEARCH_AGENT_MAX_COST_USD, DEFAULT_AGENTIC_LIMITS.maxCostUsd),
  };
}

// ─── Query planner (the only model-facing seam) ──────────────────────────────

export interface QueryPlanRequest {
  categoryName: string;
  rawQuery: string;
  /** Names already discovered — the planner is asked what is MISSING. */
  known: string[];
  /** How many queries it may propose this iteration. */
  budget: number;
}

/**
 * Proposes additional search queries. A model may implement this; the
 * deterministic implementation below is the default and the fallback.
 *
 * Note the return type: STRINGS TO SEARCH, not products. The planner is
 * structurally incapable of inventing a candidate.
 */
export interface QueryPlanner {
  readonly id: string;
  plan(request: QueryPlanRequest): Promise<string[]>;
}

/**
 * Default planner — rule-based, no model, no network, no cost.
 *
 * It covers the gap the templates in adapters.ts miss: adjacent product classes
 * and the open-source/self-hosted axis, which are exactly the candidates a
 * generic "best X" query buries.
 */
export const deterministicQueryPlanner: QueryPlanner = {
  id: "deterministic",
  async plan(request: QueryPlanRequest): Promise<string[]> {
    const cat = request.categoryName.toLowerCase();
    const proposals = [
      `open source self-hosted ${cat}`,
      `${cat} for startups pricing`,
      `lightweight ${cat} alternative`,
      `${cat} comparison ${new Date().getFullYear()}`,
    ];
    // Skip angles already well covered by what we know.
    const knownBlob = request.known.join(" ").toLowerCase();
    const fresh = proposals.filter((p) => !knownBlob.includes(p.split(" ")[0]));
    return (fresh.length ? fresh : proposals).slice(0, Math.max(0, request.budget));
  },
};

// ─── Trace ───────────────────────────────────────────────────────────────────

export interface AgenticTraceStep {
  iteration: number;
  plannedQueries: string[];
  resultsSeen: number;
  candidatesAdded: number;
  /** Names the planner suggested that no search result corroborated. */
  discardedUncorroborated: string[];
}

export interface AgenticTrace {
  planner: string;
  steps: AgenticTraceStep[];
  limits: AgenticLimits;
  usage: {
    iterations: number;
    queries: number;
    candidateUrls: number;
    durationMs: number;
    costUsd: number;
  };
  /** Which limit stopped the loop, when one did. */
  stoppedBy: "iterations" | "queries" | "urls" | "duration" | "cost" | "sufficient" | "no_provider" | null;
}

// ─── The adapter ─────────────────────────────────────────────────────────────

export class AgenticDiscoveryAdapter implements CandidateDiscoveryAdapter {
  readonly id = "agentic";
  readonly layer = "agentic" as const;

  private lastTrace: AgenticTrace | null = null;

  constructor(
    private readonly provider: WebSearchProvider | null,
    private readonly budget: SearchBudget,
    private readonly limits: AgenticLimits = DEFAULT_AGENTIC_LIMITS,
    private readonly planner: QueryPlanner = deterministicQueryPlanner,
    /** Names found by earlier layers, so the planner targets the gap. */
    private readonly known: () => string[] = () => []
  ) {}

  /** Development diagnostics only — never included in a production response. */
  getTrace(): AgenticTrace | null {
    return this.lastTrace;
  }

  supports(context: DiscoveryContext): boolean {
    // Only worth running when the pool is genuinely short.
    return (
      this.provider !== null &&
      this.provider.isConfigured() &&
      this.limits.maxIterations > 0 &&
      context.wanted > 0
    );
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryAdapterOutcome> {
    const started = Date.now();
    const out: DiscoveryAdapterOutcome = { ...emptyOutcome() };
    const trace: AgenticTrace = {
      planner: this.planner.id,
      steps: [],
      limits: this.limits,
      usage: { iterations: 0, queries: 0, candidateUrls: 0, durationMs: 0, costUsd: 0 },
      stoppedBy: null,
    };

    const provider = this.provider;
    if (!provider) {
      trace.stoppedBy = "no_provider";
      this.lastTrace = trace;
      out.issues.push(issue("discover", "source_unavailable", "Agentic fallback has no provider.", this.id));
      return out;
    }

    const seenDomains = new Set<string>();

    for (let iteration = 1; iteration <= this.limits.maxIterations; iteration++) {
      // ── Every limit is checked by the LOOP before any work happens ──────
      if (trace.usage.queries >= this.limits.maxQueries) { trace.stoppedBy = "queries"; break; }
      if (trace.usage.candidateUrls >= this.limits.maxCandidateUrls) { trace.stoppedBy = "urls"; break; }
      if (Date.now() - started >= this.limits.maxDurationMs) { trace.stoppedBy = "duration"; break; }
      if (out.costUsd >= this.limits.maxCostUsd) { trace.stoppedBy = "cost"; break; }
      if (!this.budget.canSpend()) { trace.stoppedBy = "cost"; break; }
      if (context.signal?.aborted) { trace.stoppedBy = "duration"; break; }
      if (out.candidates.length >= context.wanted) { trace.stoppedBy = "sufficient"; break; }

      trace.usage.iterations = iteration;

      const remainingQueries = this.limits.maxQueries - trace.usage.queries;
      let planned: string[];
      try {
        planned = await this.planner.plan({
          categoryName: context.categoryName,
          rawQuery: context.rawQuery,
          known: [...this.known(), ...out.candidates.map((c) => c.name)],
          budget: Math.min(remainingQueries, 2),
        });
      } catch {
        // A failing planner degrades to no extra coverage; it never breaks search.
        out.issues.push(issue("discover", "fallback_used", "Query planner failed; skipping agentic layer.", this.id));
        break;
      }

      // Enforce the cap on whatever the planner returned, however it behaved.
      planned = planned.filter((q) => typeof q === "string" && q.trim()).slice(0, remainingQueries);
      if (planned.length === 0) { trace.stoppedBy = "queries"; break; }

      const step: AgenticTraceStep = {
        iteration,
        plannedQueries: planned,
        resultsSeen: 0,
        candidatesAdded: 0,
        discardedUncorroborated: [],
      };

      for (const q of planned) {
        if (trace.usage.queries >= this.limits.maxQueries) break;
        if (Date.now() - started >= this.limits.maxDurationMs) break;
        if (!this.budget.canSpend()) break;

        const outcome = await provider.search({ q, count: 10 }, context.signal);
        trace.usage.queries += 1;
        this.budget.record(outcome.requestCount, provider.costPerRequestUsd, outcome.durationMs);
        out.externalCalls += outcome.requestCount;
        out.costUsd += outcome.requestCount * provider.costPerRequestUsd;
        out.queriesIssued.push(q);

        if (!outcome.ok) {
          out.issues.push(providerIssue(outcome.error, provider.id));
          if (!outcome.error.retryable) break;
          continue;
        }

        step.resultsSeen += outcome.results.length;

        for (const r of dedupeByDomain(outcome.results)) {
          if (trace.usage.candidateUrls >= this.limits.maxCandidateUrls) break;

          const norm = normalizeDiscoveredUrl(r.url);
          if (!norm || norm.isJunk || norm.isAggregator) continue;
          if (seenDomains.has(norm.domainKey)) continue;
          seenDomains.add(norm.domainKey);
          trace.usage.candidateUrls += 1;

          out.candidates.push(
            candidate({
              name: productNameFromTitle(r.title, norm.host),
              candidateUrl: `https://${norm.host}`,
              sourceUrl: r.url,
              sourceAdapter: this.id,
              layer: this.layer,
              snippet: r.snippet || null,
              categoryHints: [context.categoryId],
              // Lowest identity confidence of any layer: this came from a
              // generated query, so resolution must work hardest to verify it.
              discoveryConfidence: 0.35,
              discoveredAt: context.now.toISOString(),
            })
          );
          step.candidatesAdded += 1;
        }
      }

      trace.steps.push(step);
    }

    trace.usage.durationMs = Date.now() - started;
    trace.usage.costUsd = Math.round(out.costUsd * 10_000) / 10_000;
    if (!trace.stoppedBy && trace.usage.iterations >= this.limits.maxIterations) {
      trace.stoppedBy = "iterations";
    }
    this.lastTrace = trace;

    return out;
  }
}
