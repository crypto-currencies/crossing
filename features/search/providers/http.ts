/**
 * Shared provider transport: timeout, retry classification, and safe error
 * handling. Every provider adapter goes through `providerFetch` so timeout and
 * retry semantics are identical across vendors rather than reimplemented four
 * times with four subtly different bugs.
 */

import {
  MAX_ATTEMPTS,
  PROVIDER_TIMEOUT_MS,
  classifyStatus,
  type ProviderError,
  type WebSearchOutcome,
  type WebSearchResult,
} from "./types";

export interface ProviderFetchOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Injectable for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch JSON from a provider with a hard timeout and bounded retries.
 *
 * Retries only on classified-retryable errors (429, 5xx, network, timeout), and
 * never more than MAX_ATTEMPTS total — an unauthorized key must fail instantly,
 * not burn the request budget.
 */
export async function providerFetch<T>(
  options: ProviderFetchOptions
): Promise<
  | { ok: true; data: T; requestCount: number; durationMs: number }
  | { ok: false; error: ProviderError; requestCount: number; durationMs: number }
> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;
  let requestCount = 0;
  let lastError: ProviderError = { kind: "network", retryable: true, detail: "no attempt made" };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Caller-level cancellation wins over our own timeout.
    if (options.signal?.aborted) {
      return {
        ok: false,
        error: { kind: "timeout", retryable: false, detail: "request cancelled" },
        requestCount,
        durationMs: Date.now() - started,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onOuterAbort, { once: true });

    requestCount += 1;
    try {
      const res = await doFetch(options.url, {
        headers: { accept: "application/json", ...options.headers },
        signal: controller.signal,
      });

      if (!res.ok) {
        // Read a bounded amount of the body for operator diagnostics only.
        const detail = await safeSnippet(res);
        lastError = classifyStatus(res.status, detail);
        if (!lastError.retryable) break;
        continue;
      }

      const data = (await res.json()) as T;
      return { ok: true, data, requestCount, durationMs: Date.now() - started };
    } catch (err) {
      lastError = classifyThrown(err, controller.signal.aborted);
      if (!lastError.retryable) break;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  return { ok: false, error: lastError, requestCount, durationMs: Date.now() - started };
}

function classifyThrown(err: unknown, aborted: boolean): ProviderError {
  if (aborted) {
    return { kind: "timeout", retryable: true, detail: `no response within timeout` };
  }
  const name = err instanceof Error ? err.name : "unknown";
  return { kind: "network", retryable: true, detail: `network error (${name})` };
}

/**
 * A short, sanitized excerpt of an error body — enough for an operator to
 * diagnose, never enough to leak a key or a full upstream payload.
 */
async function safeSnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 200).replace(/\s+/g, " ").trim();
  } catch {
    return `status ${res.status}`;
  }
}

/** Wrap a successful provider parse into the common outcome shape. */
export function outcomeOf(
  results: WebSearchResult[],
  requestCount: number,
  durationMs: number
): WebSearchOutcome {
  return { ok: true, results, requestCount, durationMs };
}
