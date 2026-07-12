/**
 * URL normalization shared by listings and submissions so superficial
 * variations of the same site (http vs https, www vs bare, trailing slash,
 * default port) don't create duplicate listings.
 *
 * Deliberately NOT invasive: no following redirects, no fetching the target,
 * no stripping arbitrary tracking params beyond an empty query string. Just
 * string-level canonicalization of what the user typed.
 */

const DEFAULT_PORTS: Record<string, string> = {
  "http:": "80",
  "https:": "443",
};

/** Throws if `raw` isn't a syntactically valid http(s) URL. */
export function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns a comparison key for duplicate detection — NOT a display URL.
 * Lowercases the host, strips a leading "www.", drops a default port,
 * strips a trailing slash from the path, and drops an empty query/hash.
 *
 * @throws Error("invalid_url") if `raw` isn't a valid http(s) URL.
 */
export function normalizeUrlKey(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_url");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port && url.port !== DEFAULT_PORTS[url.protocol] ? `:${url.port}` : "";
  const path = url.pathname.replace(/\/+$/, "");
  const search = url.search === "?" ? "" : url.search;

  return `${host}${port}${path}${search}`;
}
