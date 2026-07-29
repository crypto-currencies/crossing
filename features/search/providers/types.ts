/**
 * Provider-agnostic web search.
 *
 * NO VENDOR IS HARDCODED ANYWHERE outside `./registry.ts`. Every call site talks
 * to `WebSearchProvider`; the concrete provider is chosen from env at runtime.
 * Swapping Bing for Brave is a config change, not a code change.
 *
 * Hard rule: these adapters call OFFICIAL SEARCH APIs only. Scraping a search
 * engine's result pages is prohibited — it violates every major engine's terms
 * and produces brittle, unattributable data.
 */

import type { StageIssue } from "../contracts";

/** Identifiers for the providers this codebase knows how to talk to. */
export const PROVIDER_IDS = ["bing", "brave", "google-pse", "serper"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface WebSearchQuery {
  /** The search string. Already bounded by MAX_QUERY_CHARS at the call site. */
  q: string;
  /** Max results wanted. Providers cap this to their own page size. */
  count: number;
  /** Restrict to a site/domain when a caller wants official-site confirmation. */
  site?: string;
  /** Two-letter market/region hint, when the provider supports it. */
  market?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  /** Provider-supplied snippet. Evidence-bearing text, never a quality claim. */
  snippet: string;
  /** Provider's own ranking position, 1-based. Not a quality signal. */
  position: number;
}

/**
 * Why a provider call failed. `retryable` is what the caller uses to decide
 * whether a retry could help — a 429 can, a 401 never will.
 */
export type ProviderErrorKind =
  | "unauthorized"
  | "rate_limited"
  | "quota_exceeded"
  | "timeout"
  | "network"
  | "bad_response"
  | "not_configured";

export interface ProviderError {
  kind: ProviderErrorKind;
  retryable: boolean;
  /**
   * Operator-facing detail. NEVER surfaced to an end user and never contains
   * the API key, the raw provider body, or upstream stack traces.
   */
  detail: string;
  /** HTTP status when there was one. */
  status?: number;
}

export interface WebSearchSuccess {
  ok: true;
  results: WebSearchResult[];
  /** Requests actually issued (retries included) — feeds cost tracking. */
  requestCount: number;
  /** Wall-clock ms spent in the provider. */
  durationMs: number;
}

export type WebSearchOutcome = WebSearchSuccess | { ok: false; error: ProviderError; requestCount: number; durationMs: number };

export interface WebSearchProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** False when credentials are absent — the pipeline then skips it cleanly. */
  isConfigured(): boolean;
  /** Estimated USD per request, for budget tracking. 0 when unknown/free tier. */
  readonly costPerRequestUsd: number;
  search(query: WebSearchQuery, signal?: AbortSignal): Promise<WebSearchOutcome>;
}

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Per-request provider timeout. Search must stay interactive. */
export const PROVIDER_TIMEOUT_MS = 3_000;
/** Longest query string we will ever send upstream. */
export const MAX_QUERY_CHARS = 200;
/** Max results requested from a single provider call. */
export const MAX_RESULTS_PER_CALL = 20;
/** Retry budget for a single logical search (total attempts, not per-error). */
export const MAX_ATTEMPTS = 2;

/**
 * Translate an HTTP status into a classified error. Centralized so every
 * provider classifies retryability identically.
 */
export function classifyStatus(status: number, detail: string): ProviderError {
  if (status === 401 || status === 403) {
    return { kind: "unauthorized", retryable: false, detail, status };
  }
  if (status === 429) {
    return { kind: "rate_limited", retryable: true, detail, status };
  }
  if (status === 402) {
    return { kind: "quota_exceeded", retryable: false, detail, status };
  }
  if (status >= 500) {
    return { kind: "bad_response", retryable: true, detail, status };
  }
  return { kind: "bad_response", retryable: false, detail, status };
}

/**
 * Public-safe rendering of a provider failure. This is the ONLY string that may
 * reach a user — raw provider errors never leave the server.
 */
export function publicMessageFor(error: ProviderError): string {
  switch (error.kind) {
    case "not_configured":
      return "Live search is not configured in this environment.";
    case "timeout":
    case "network":
      return "A search source did not respond in time.";
    case "rate_limited":
    case "quota_exceeded":
      return "Search is temporarily over capacity.";
    default:
      return "A search source was unavailable.";
  }
}

export function providerIssue(error: ProviderError, providerId: string): StageIssue {
  return {
    stage: "discover",
    code:
      error.kind === "timeout"
        ? "source_timeout"
        : error.kind === "quota_exceeded" || error.kind === "rate_limited"
          ? "budget_exhausted"
          : error.kind === "not_configured"
            ? "source_unavailable"
            : "source_rejected",
    // Operator detail only; the response layer substitutes publicMessageFor().
    detail: `[${providerId}] ${error.kind}: ${error.detail}`,
    subject: providerId,
  };
}
