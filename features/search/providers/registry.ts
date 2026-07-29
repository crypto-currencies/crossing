/**
 * Provider selection + budget enforcement.
 *
 * This is the ONLY module that knows which vendors exist. `SEARCH_PROVIDER`
 * picks one; if it is unset, the first provider with credentials wins, and if
 * none has credentials the pipeline gets `null` and degrades honestly rather
 * than pretending to have searched.
 *
 * `SearchBudget` bounds a single user request across every provider call it
 * makes: query count, wall time, and estimated spend. It is the mechanism that
 * stops one expensive search from running away.
 */

import {
  BingSearchProvider,
  BraveSearchProvider,
  GooglePseSearchProvider,
  SerperSearchProvider,
  type AdapterDeps,
} from "./adapters";
import { PROVIDER_IDS, type ProviderId, type WebSearchProvider } from "./types";

/** Construct every known provider. Order is the fallback preference order. */
export function allProviders(deps: AdapterDeps): WebSearchProvider[] {
  return [
    new BraveSearchProvider(deps),
    new BingSearchProvider(deps),
    new SerperSearchProvider(deps),
    new GooglePseSearchProvider(deps),
  ];
}

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Resolve the active provider.
 *
 * Returns null when nothing is configured — callers MUST handle that by
 * reporting reduced coverage, never by substituting fabricated results.
 */
export function resolveProvider(deps: AdapterDeps): WebSearchProvider | null {
  const providers = allProviders(deps);
  const requested = (deps.env.SEARCH_PROVIDER ?? "").trim().toLowerCase();

  if (requested) {
    if (!isProviderId(requested)) return null;
    const chosen = providers.find((p) => p.id === requested);
    // An explicitly requested provider is never silently swapped for another —
    // a misconfigured deployment should be visible, not quietly papered over.
    return chosen && chosen.isConfigured() ? chosen : null;
  }

  return providers.find((p) => p.isConfigured()) ?? null;
}

/** Which providers hold credentials — for the admin/diagnostics surface. */
export function configuredProviderIds(deps: AdapterDeps): ProviderId[] {
  return allProviders(deps)
    .filter((p) => p.isConfigured())
    .map((p) => p.id);
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export interface BudgetLimits {
  /** Max provider queries for one user search. */
  maxQueries: number;
  /** Max estimated USD for one user search. */
  maxCostUsd: number;
  /** Max wall-clock ms across all provider calls. */
  maxDurationMs: number;
}

export const DEFAULT_BUDGET: BudgetLimits = {
  maxQueries: 6,
  maxCostUsd: 0.05,
  maxDurationMs: 6_000,
};

export interface BudgetSnapshot {
  queries: number;
  costUsd: number;
  durationMs: number;
  exhausted: boolean;
  /** Which limit tripped first, when one did. */
  exhaustedBy: "queries" | "cost" | "duration" | null;
}

/**
 * Mutable per-request budget. Every provider call checks `canSpend()` first and
 * records its actual usage after — so a runaway loop is stopped by accounting,
 * not by hoping the caller behaves.
 */
export class SearchBudget {
  private queries = 0;
  private costUsd = 0;
  private durationMs = 0;

  constructor(private readonly limits: BudgetLimits = DEFAULT_BUDGET) {}

  canSpend(): boolean {
    return !this.snapshot().exhausted;
  }

  record(requestCount: number, costPerRequestUsd: number, durationMs: number): void {
    this.queries += requestCount;
    this.costUsd += requestCount * costPerRequestUsd;
    this.durationMs += durationMs;
  }

  snapshot(): BudgetSnapshot {
    const exhaustedBy =
      this.queries >= this.limits.maxQueries
        ? "queries"
        : this.costUsd >= this.limits.maxCostUsd
          ? "cost"
          : this.durationMs >= this.limits.maxDurationMs
            ? "duration"
            : null;
    return {
      queries: this.queries,
      // Round to cents-of-a-cent so the number is readable in logs.
      costUsd: Math.round(this.costUsd * 10_000) / 10_000,
      durationMs: Math.round(this.durationMs),
      exhausted: exhaustedBy !== null,
      exhaustedBy,
    };
  }

  get remainingQueries(): number {
    return Math.max(0, this.limits.maxQueries - this.queries);
  }
}

/** Read budget limits from env, falling back to the defaults. */
export function budgetFromEnv(env: NodeJS.ProcessEnv): BudgetLimits {
  const num = (raw: string | undefined, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    maxQueries: num(env.SEARCH_MAX_QUERIES, DEFAULT_BUDGET.maxQueries),
    maxCostUsd: num(env.SEARCH_MAX_COST_USD, DEFAULT_BUDGET.maxCostUsd),
    maxDurationMs: num(env.SEARCH_MAX_PROVIDER_MS, DEFAULT_BUDGET.maxDurationMs),
  };
}
