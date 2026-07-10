/**
 * Upstash Redis sliding-window rate limiter.
 *
 * Requires:
 *   UPSTASH_REDIS_REST_URL    — from Upstash console → Redis → REST API
 *   UPSTASH_REDIS_REST_TOKEN  — from the same page
 *
 * Without those vars the limiter fails open (allows all requests) so
 * local development works without a Redis instance. A warning is logged
 * in production so the gap is visible in Vercel Function Logs.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Types ────────────────────────────────────────────────────────────────────

// Mirrors @upstash/ratelimit's Duration type — kept local to avoid a brittle import.
type Unit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number} ${Unit}` | `${number}${Unit}`;

// ─── Redis client (lazy) ──────────────────────────────────────────────────────

// `undefined` = not yet initialised; `null` = env vars absent; `Redis` = ready.
let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
          "Rate limiting is DISABLED. Add these env vars in Vercel to enable it.",
      );
    }
    _redis = null;
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Ratelimit instance cache ─────────────────────────────────────────────────
// One Ratelimit instance per unique (maxRequests, windowMs) pair.
// Instances are cheap to create and safe to share across requests in the same
// warm function invocation; the actual counters live in Redis.

const _limiters = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cacheKey = `${maxRequests}:${windowMs}`;
  const cached = _limiters.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, msToDuration(windowMs)),
    // Namespace by config so limiters with different budgets never share keys.
    prefix: `rl:${maxRequests}:${windowMs}`,
    // Keep analytics off — reduces Redis writes and avoids extra permissions.
    analytics: false,
  });

  _limiters.set(cacheKey, limiter);
  return limiter;
}

/** Convert a millisecond window to the shortest Upstash Duration string. */
function msToDuration(ms: number): Duration {
  if (ms % 86_400_000 === 0) return `${ms / 86_400_000} d`;
  if (ms % 3_600_000  === 0) return `${ms / 3_600_000} h`;
  if (ms % 60_000     === 0) return `${ms / 60_000} m`;
  if (ms % 1_000      === 0) return `${ms / 1_000} s`;
  return `${ms} ms`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sliding-window rate limit via Upstash Redis.
 *
 * Returns `true`  → request is within budget, proceed normally.
 * Returns `false` → limit exceeded, return 429.
 *
 * Fails **open** (returns `true`) when:
 *   - Upstash env vars are absent (local dev).
 *   - Redis is unreachable (transient network error).
 *
 * Key should encode both the endpoint and the principal, e.g.:
 *   `login:${ip}`  or  `change-password:${ip}:${userId}`
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const limiter = getLimiter(maxRequests, windowMs);
  if (!limiter) return true; // fail open — limiter not configured

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    // Fail open on transient Redis errors to avoid taking the app down.
    console.error("[rate-limit] Upstash error:", err);
    return true;
  }
}

/**
 * Extract the real client IP from proxy headers.
 *
 * Priority:
 *   1. x-vercel-forwarded-for  — set by Vercel's edge network on every request
 *   2. x-real-ip               — set by nginx and many other reverse proxies
 *   3. x-forwarded-for         — standard de-facto header (take leftmost/first entry)
 */
export function clientIp(request: Request): string {
  // Vercel injects this before the request reaches your function — it cannot
  // be spoofed by the client because Vercel strips it from incoming requests
  // and re-adds it with the actual connecting IP.
  const vercelFwd = request.headers.get("x-vercel-forwarded-for");
  if (vercelFwd) return vercelFwd.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // x-forwarded-for can contain a chain of IPs; the leftmost is the original client.
  const fwdFor = request.headers.get("x-forwarded-for");
  if (fwdFor) return fwdFor.split(",")[0].trim();

  return "unknown";
}
