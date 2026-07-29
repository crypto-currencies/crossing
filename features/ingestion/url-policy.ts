/**
 * URL origin policy for controlled ingestion.
 *
 * Ingestion NEVER fetches an arbitrary URL. Every fetch target must resolve to
 * an approved origin declared in the registry (registry.ts). This module owns
 * the normalization + matching rules so "the same origin" is decided in exactly
 * one place: protocol, hostname (lowercased, `www.` stripped, IDN→punycode via
 * the URL parser), and port (default ports dropped). Paths are not part of the
 * origin — a page URL is allowed when its origin matches and it was explicitly
 * configured in the registry.
 */

export interface NormalizedOrigin {
  /** "https:" | "http:" */
  protocol: string;
  /** Lowercased, `www.`-stripped, punycode host. */
  host: string;
  /** Empty string when the port is the scheme default. */
  port: string;
  /** `${protocol}//${host}${port ? ":"+port : ""}` */
  key: string;
}

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

/** Parse an http(s) URL, returning null for anything invalid or non-http(s). */
export function parseHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

/** Normalize an http(s) URL to a comparable origin. Returns null when invalid. */
export function normalizeOrigin(raw: string): NormalizedOrigin | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  // URL already lowercases and punycodes the hostname.
  const host = url.hostname.replace(/^www\./, "");
  const port = url.port && url.port !== DEFAULT_PORTS[url.protocol] ? url.port : "";
  const key = `${url.protocol}//${host}${port ? `:${port}` : ""}`;
  return { protocol: url.protocol, host, port, key };
}

export interface OriginMatchOptions {
  /** Allow subdomains of the approved host (e.g. docs.example.com for example.com). */
  allowSubdomains?: boolean;
}

/**
 * True when `candidate` is within `approved` under the given rules. Exact origin
 * match by default; with allowSubdomains, a strict subdomain of the approved
 * host (same protocol + port) is also accepted. Never matches a parent domain or
 * a look-alike suffix (foo-example.com is NOT within example.com).
 */
export function isWithinApprovedOrigin(
  candidate: string,
  approved: string,
  options: OriginMatchOptions = {}
): boolean {
  const c = normalizeOrigin(candidate);
  const a = normalizeOrigin(approved);
  if (!c || !a) return false;
  if (c.protocol !== a.protocol || c.port !== a.port) return false;
  if (c.host === a.host) return true;
  if (options.allowSubdomains && c.host.endsWith(`.${a.host}`)) return true;
  return false;
}

/** True when `url` is within ANY of the approved origins. */
export function isUrlApproved(
  url: string,
  approvedOrigins: string[],
  options: OriginMatchOptions = {}
): boolean {
  return approvedOrigins.some((origin) => isWithinApprovedOrigin(url, origin, options));
}

/**
 * Decide whether a redirect hop is allowed. A redirect that lands within an
 * approved origin is fine; one that leaves it is rejected unless
 * `allowOffOriginRedirect` is explicitly set for the source.
 */
export function isRedirectAllowed(
  toUrl: string,
  approvedOrigins: string[],
  options: OriginMatchOptions & { allowOffOriginRedirect?: boolean } = {}
): boolean {
  if (options.allowOffOriginRedirect) return parseHttpUrl(toUrl) !== null;
  return isUrlApproved(toUrl, approvedOrigins, options);
}
