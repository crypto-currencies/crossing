/**
 * Canonical app base URL — server-only. THE single source of truth for every
 * absolute link the backend generates (all transactional emails, OAuth
 * integration redirect URIs, etc.).
 *
 * The rule: production links MUST point at the production canonical origin —
 * never www, http, localhost, or a *.vercel.app preview host — or the link
 * either breaks (a localhost link is dead in a user's inbox) or bounces through
 * a redirect that can strip the token.
 *
 * Resolution:
 *   1. Read the first configured origin from, in order:
 *        NEXT_PUBLIC_APP_URL → APP_URL → SITE_URL → NEXTAUTH_URL → AUTH_URL
 *   2. Normalize it: force https, strip a leading `www.`, drop any path/query,
 *      and remove the trailing slash (localhost keeps http for local dev).
 *   3. In production, REFUSE localhost / *.vercel.app / empty values and fall
 *      back to the hard canonical (CANONICAL_PROD_URL). This is what makes a
 *      missing or wrong env var (e.g. NEXTAUTH_URL left at http://localhost:3000)
 *      unable to ever produce a broken production email link.
 *
 * Note: NextAuth reads NEXTAUTH_URL directly for its own OAuth callback URLs
 * (e.g. https://crossing.dev/api/auth/callback/github) — this helper does not
 * affect that path. Keep NEXTAUTH_URL set to https://crossing.dev in production.
 *
 * Import only from server code (API routes, server actions, lib/server/*).
 */

/** Hard production canonical — the single source of truth for absolute links. */
export const CANONICAL_PROD_URL = "https://crossing.dev";

/**
 * Normalize a raw origin string to a canonical `scheme://host` with no path or
 * trailing slash. Returns "" when the input can't be parsed as a URL.
 */
function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    // Accept bare hosts ("crossing.dev") as well as full URLs.
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (!isLocalhost) {
      u.protocol = "https:";                          // never http in prod
      u.hostname = u.hostname.replace(/^www\./, "");  // never www
    }
    // u.origin drops path/query/hash and the trailing slash.
    return u.origin;
  } catch {
    return "";
  }
}

/**
 * getBaseUrl() — the canonical absolute base URL for this deployment.
 *
 * Every email link and server-generated absolute URL MUST derive from this so
 * there is exactly one place that decides the host. Guaranteed to return
 * `https://crossing.dev` in production even when the environment is misconfigured.
 */
export function getBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.SITE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "";

  const normalized = normalizeOrigin(raw);

  if (process.env.NODE_ENV === "production") {
    // Never emit a preview / localhost / empty origin from production links.
    const isPreview = normalized.endsWith(".vercel.app");
    const isLocal   = normalized.includes("localhost") || normalized.includes("127.0.0.1");
    if (!normalized || isPreview || isLocal) {
      return CANONICAL_PROD_URL;
    }
    return normalized;
  }

  // Development / test: use the configured origin if any, else localhost.
  return normalized || "http://localhost:3000";
}

/**
 * @deprecated Use {@link getBaseUrl}. Retained as an alias so existing callers
 * keep working; both resolve identically.
 */
export function siteUrl(): string {
  return getBaseUrl();
}
