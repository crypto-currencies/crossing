/**
 * Server-only safe HTTP fetcher for controlled ingestion.
 *
 * Protections: approved-origin validation on every hop, SSRF/private-IP blocking
 * (ssrf.ts), manual redirect handling with a hop cap and per-hop revalidation,
 * request timeout, response-size cap (guards decompression bombs since the cap
 * is on DECODED bytes), content-type allowlist, and a Crossing-identifying
 * user-agent. Never executes page JavaScript; never uses browser automation.
 *
 * `fetchImpl` and `lookup` are injectable so tests run fully offline.
 */

import { isUrlApproved, isRedirectAllowed, parseHttpUrl } from "./url-policy";
import { assertPublicHost, SsrfBlockedError, type LookupFn } from "./ssrf";

export const CROSSING_USER_AGENT =
  "CrossingBot/0.1 (+https://crossing.dev/bot; evidence ingestion; contact: bot@crossing.dev)";

export const DEFAULT_ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

export interface FetchPolicy {
  approvedOrigins: string[];
  allowSubdomains?: boolean;
  allowOffOriginRedirect?: boolean;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  allowedContentTypes?: string[];
  userAgent?: string;
}

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  lookup?: LookupFn;
  now?: () => number;
}

export type FetchErrorKind =
  | "invalid_url"
  | "blocked_origin"
  | "ssrf_blocked"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "unsupported_content_type"
  | "http_error"
  | "network_error";

export interface FetchError {
  kind: FetchErrorKind;
  message: string;
  status?: number;
  /** True → a retry later might succeed (timeout, network, 429/5xx). */
  retryable: boolean;
}

export interface FetchSuccess {
  ok: true;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  durationMs: number;
  redirectChain: string[];
  lastModified: string | null;
  etag: string | null;
}

export type FetchResult = FetchSuccess | { ok: false; error: FetchError };

const DEFAULTS = {
  timeoutMs: 8000,
  maxRedirects: 3,
  maxBytes: 2_000_000,
};

function err(kind: FetchErrorKind, message: string, retryable: boolean, status?: number): FetchResult {
  return { ok: false, error: { kind, message, retryable, status } };
}

async function defaultLookup(hostname: string): Promise<{ address: string; family: number }[]> {
  const dns = await import("node:dns/promises");
  return dns.lookup(hostname, { all: true });
}

/** Read a response body, enforcing a hard byte cap on the decoded stream. */
async function readCapped(res: Response, maxBytes: number): Promise<{ body: string; bytes: number } | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    const bytes = Buffer.byteLength(text);
    return bytes > maxBytes ? null : { body: text, bytes };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  }
  const body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  return { body, bytes: total };
}

/**
 * Fetch one approved URL safely. `url` MUST already be an approved origin — the
 * fetcher re-validates it and every redirect hop regardless.
 */
export async function safeFetch(url: string, policy: FetchPolicy, deps: FetchDeps = {}): Promise<FetchResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const lookup = deps.lookup ?? defaultLookup;
  const clock = deps.now ?? (() => Date.now());

  const timeoutMs = policy.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRedirects = policy.maxRedirects ?? DEFAULTS.maxRedirects;
  const maxBytes = policy.maxBytes ?? DEFAULTS.maxBytes;
  const allowedTypes = policy.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const userAgent = policy.userAgent ?? CROSSING_USER_AGENT;
  const matchOpts = { allowSubdomains: policy.allowSubdomains };

  const started = clock();
  const redirectChain: string[] = [];
  let current = url;

  // The initial target must be approved; redirects are checked per-hop below.
  if (!isUrlApproved(current, policy.approvedOrigins, matchOpts)) {
    return err("blocked_origin", `initial URL is not within an approved origin: ${current}`, false);
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = parseHttpUrl(current);
    if (!parsed) return err("invalid_url", `not a valid http(s) URL: ${current}`, false);

    try {
      await assertPublicHost(parsed.hostname, lookup);
    } catch (e) {
      const detail = e instanceof SsrfBlockedError ? e.message : "host validation failed";
      return err("ssrf_blocked", detail, false);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,text/plain" },
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e instanceof Error && e.name === "AbortError";
      return aborted
        ? err("timeout", `request timed out after ${timeoutMs}ms`, true)
        : err("network_error", e instanceof Error ? e.message : "network error", true);
    }
    clearTimeout(timer);

    // Redirect handling.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return err("http_error", `redirect ${res.status} with no Location`, false, res.status);
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        return err("invalid_url", `invalid redirect target: ${location}`, false);
      }
      if (!parseHttpUrl(next)) return err("blocked_origin", `redirect to non-http(s): ${next}`, false);
      if (!isRedirectAllowed(next, policy.approvedOrigins, { ...matchOpts, allowOffOriginRedirect: policy.allowOffOriginRedirect })) {
        return err("blocked_origin", `redirect leaves approved origin: ${next}`, false);
      }
      redirectChain.push(next);
      current = next;
      continue;
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      return err("http_error", `HTTP ${res.status}`, retryable, res.status);
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (contentType && !allowedTypes.includes(contentType)) {
      return err("unsupported_content_type", `content-type not allowed: ${contentType}`, false, res.status);
    }

    const read = await readCapped(res, maxBytes);
    if (!read) return err("too_large", `response exceeded ${maxBytes} bytes`, false, res.status);

    return {
      ok: true,
      finalUrl: current,
      status: res.status,
      contentType: contentType || "text/html",
      body: read.body,
      bytes: read.bytes,
      durationMs: clock() - started,
      redirectChain,
      lastModified: res.headers.get("last-modified"),
      etag: res.headers.get("etag"),
    };
  }

  return err("too_many_redirects", `exceeded ${maxRedirects} redirects`, false);
}
