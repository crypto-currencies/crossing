/**
 * Concrete search-provider adapters.
 *
 * All four implement the same `WebSearchProvider` interface and are selected by
 * env (see ./registry.ts). Each one:
 *   - calls the vendor's OFFICIAL API (never scrapes result pages),
 *   - requests safe-search where the vendor supports it,
 *   - reports its own per-request cost for budget tracking,
 *   - and returns `not_configured` rather than throwing when its key is absent.
 *
 * Adding a fifth provider means adding a class here and one registry entry.
 * Nothing else in the codebase changes.
 */

import { providerFetch, outcomeOf } from "./http";
import {
  MAX_QUERY_CHARS,
  MAX_RESULTS_PER_CALL,
  type ProviderId,
  type WebSearchOutcome,
  type WebSearchProvider,
  type WebSearchQuery,
  type WebSearchResult,
} from "./types";

export interface AdapterDeps {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

/** Clamp and site-scope a query before it ever leaves the process. */
function buildQueryString(query: WebSearchQuery): string {
  const base = query.site ? `site:${query.site} ${query.q}` : query.q;
  return base.slice(0, MAX_QUERY_CHARS);
}

function clampCount(count: number): number {
  return Math.min(Math.max(Math.floor(count), 1), MAX_RESULTS_PER_CALL);
}

const notConfigured = (label: string): WebSearchOutcome => ({
  ok: false,
  error: { kind: "not_configured", retryable: false, detail: `${label} credentials absent` },
  requestCount: 0,
  durationMs: 0,
});

// ─── Bing Web Search ─────────────────────────────────────────────────────────

interface BingResponse {
  webPages?: { value?: { name?: string; url?: string; snippet?: string }[] };
}

export class BingSearchProvider implements WebSearchProvider {
  readonly id: ProviderId = "bing";
  readonly label = "Bing Web Search";
  readonly costPerRequestUsd = 0.005;

  constructor(private readonly deps: AdapterDeps) {}

  isConfigured(): boolean {
    return Boolean(this.deps.env.BING_SEARCH_API_KEY);
  }

  async search(query: WebSearchQuery, signal?: AbortSignal): Promise<WebSearchOutcome> {
    const key = this.deps.env.BING_SEARCH_API_KEY;
    if (!key) return notConfigured(this.label);

    const endpoint = this.deps.env.BING_SEARCH_ENDPOINT ?? "https://api.bing.microsoft.com/v7.0/search";
    const url = new URL(endpoint);
    url.searchParams.set("q", buildQueryString(query));
    url.searchParams.set("count", String(clampCount(query.count)));
    url.searchParams.set("safeSearch", "Moderate");
    url.searchParams.set("responseFilter", "Webpages");
    if (query.market) url.searchParams.set("mkt", query.market);

    const res = await providerFetch<BingResponse>({
      url: url.toString(),
      headers: { "Ocp-Apim-Subscription-Key": key },
      signal,
      fetchImpl: this.deps.fetchImpl,
    });
    if (!res.ok) return res;

    const results: WebSearchResult[] = (res.data.webPages?.value ?? [])
      .map((v, i) => ({
        title: v.name ?? "",
        url: v.url ?? "",
        snippet: v.snippet ?? "",
        position: i + 1,
      }))
      .filter((r) => r.url);

    return outcomeOf(results, res.requestCount, res.durationMs);
  }
}

// ─── Brave Search ────────────────────────────────────────────────────────────

interface BraveResponse {
  web?: { results?: { title?: string; url?: string; description?: string }[] };
}

export class BraveSearchProvider implements WebSearchProvider {
  readonly id: ProviderId = "brave";
  readonly label = "Brave Search";
  readonly costPerRequestUsd = 0.003;

  constructor(private readonly deps: AdapterDeps) {}

  isConfigured(): boolean {
    return Boolean(this.deps.env.BRAVE_SEARCH_API_KEY);
  }

  async search(query: WebSearchQuery, signal?: AbortSignal): Promise<WebSearchOutcome> {
    const key = this.deps.env.BRAVE_SEARCH_API_KEY;
    if (!key) return notConfigured(this.label);

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", buildQueryString(query));
    url.searchParams.set("count", String(clampCount(query.count)));
    url.searchParams.set("safesearch", "moderate");
    if (query.market) url.searchParams.set("country", query.market);

    const res = await providerFetch<BraveResponse>({
      url: url.toString(),
      headers: { "X-Subscription-Token": key },
      signal,
      fetchImpl: this.deps.fetchImpl,
    });
    if (!res.ok) return res;

    const results: WebSearchResult[] = (res.data.web?.results ?? [])
      .map((v, i) => ({
        title: v.title ?? "",
        url: v.url ?? "",
        snippet: v.description ?? "",
        position: i + 1,
      }))
      .filter((r) => r.url);

    return outcomeOf(results, res.requestCount, res.durationMs);
  }
}

// ─── Google Programmable Search ──────────────────────────────────────────────

interface GooglePseResponse {
  items?: { title?: string; link?: string; snippet?: string }[];
}

export class GooglePseSearchProvider implements WebSearchProvider {
  readonly id: ProviderId = "google-pse";
  readonly label = "Google Programmable Search";
  readonly costPerRequestUsd = 0.005;

  constructor(private readonly deps: AdapterDeps) {}

  isConfigured(): boolean {
    return Boolean(this.deps.env.GOOGLE_PSE_API_KEY && this.deps.env.GOOGLE_PSE_ENGINE_ID);
  }

  async search(query: WebSearchQuery, signal?: AbortSignal): Promise<WebSearchOutcome> {
    const key = this.deps.env.GOOGLE_PSE_API_KEY;
    const cx = this.deps.env.GOOGLE_PSE_ENGINE_ID;
    if (!key || !cx) return notConfigured(this.label);

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", buildQueryString(query));
    // Google PSE caps num at 10 per call.
    url.searchParams.set("num", String(Math.min(clampCount(query.count), 10)));
    url.searchParams.set("safe", "active");
    if (query.market) url.searchParams.set("gl", query.market);

    const res = await providerFetch<GooglePseResponse>({
      url: url.toString(),
      signal,
      fetchImpl: this.deps.fetchImpl,
    });
    if (!res.ok) return res;

    const results: WebSearchResult[] = (res.data.items ?? [])
      .map((v, i) => ({
        title: v.title ?? "",
        url: v.link ?? "",
        snippet: v.snippet ?? "",
        position: i + 1,
      }))
      .filter((r) => r.url);

    return outcomeOf(results, res.requestCount, res.durationMs);
  }
}

// ─── Serper ──────────────────────────────────────────────────────────────────

interface SerperResponse {
  organic?: { title?: string; link?: string; snippet?: string }[];
}

export class SerperSearchProvider implements WebSearchProvider {
  readonly id: ProviderId = "serper";
  readonly label = "Serper";
  readonly costPerRequestUsd = 0.001;

  constructor(private readonly deps: AdapterDeps) {}

  isConfigured(): boolean {
    return Boolean(this.deps.env.SERPER_API_KEY);
  }

  async search(query: WebSearchQuery, signal?: AbortSignal): Promise<WebSearchOutcome> {
    const key = this.deps.env.SERPER_API_KEY;
    if (!key) return notConfigured(this.label);

    // Serper takes a POST body; providerFetch issues GET, so build the URL form
    // its API also accepts to keep one transport path.
    const url = new URL("https://google.serper.dev/search");
    url.searchParams.set("q", buildQueryString(query));
    url.searchParams.set("num", String(clampCount(query.count)));
    if (query.market) url.searchParams.set("gl", query.market);

    const res = await providerFetch<SerperResponse>({
      url: url.toString(),
      headers: { "X-API-KEY": key },
      signal,
      fetchImpl: this.deps.fetchImpl,
    });
    if (!res.ok) return res;

    const results: WebSearchResult[] = (res.data.organic ?? [])
      .map((v, i) => ({
        title: v.title ?? "",
        url: v.link ?? "",
        snippet: v.snippet ?? "",
        position: i + 1,
      }))
      .filter((r) => r.url);

    return outcomeOf(results, res.requestCount, res.durationMs);
  }
}
