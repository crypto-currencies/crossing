/**
 * Domain normalization + result filtering for discovered URLs.
 *
 * Search results are full of pages that are ABOUT products rather than pages
 * that ARE products — listicles, review roundups, forums, social posts. Those
 * are useful as *sources of mentions* but must never be mistaken for a
 * product's official site, so this module separates the two.
 */

import { normalizeDomainKey } from "@/features/recommendation/entities/normalize";

/**
 * Hosts that publish ABOUT products. A URL here is a legitimate discovery
 * source but is never a candidate's own official site.
 */
const AGGREGATOR_HOSTS = new Set([
  "reddit.com", "news.ycombinator.com", "medium.com", "dev.to", "substack.com",
  "quora.com", "stackoverflow.com", "stackexchange.com", "github.io",
  "youtube.com", "twitter.com", "x.com", "linkedin.com", "facebook.com",
  "instagram.com", "tiktok.com", "pinterest.com", "wikipedia.org",
  "producthunt.com", "g2.com", "capterra.com", "trustpilot.com",
  "getapp.com", "softwareadvice.com", "alternativeto.net", "slant.co",
]);

/** Hosts that are never a product and never a useful mention source. */
const JUNK_HOSTS = new Set([
  "google.com", "bing.com", "duckduckgo.com", "search.yahoo.com",
  "translate.google.com", "webcache.googleusercontent.com",
]);

export interface NormalizedUrl {
  /** Registrable-domain comparison key, e.g. "matomo.org". */
  domainKey: string;
  /** Lowercased host. */
  host: string;
  /** True when this host publishes about products rather than being one. */
  isAggregator: boolean;
  /** True when the URL is a search engine or cache artifact. */
  isJunk: boolean;
}

/** Normalize a discovered URL. Returns null when it is unparseable. */
export function normalizeDiscoveredUrl(raw: string): NormalizedUrl | null {
  let host: string;
  let domainKey: string;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    host = url.hostname.toLowerCase().replace(/^www\./, "");
    domainKey = normalizeDomainKey(url.origin);
  } catch {
    return null;
  }

  const registrable = registrableOf(host);
  return {
    domainKey,
    host,
    isAggregator: AGGREGATOR_HOSTS.has(registrable),
    isJunk: JUNK_HOSTS.has(registrable),
  };
}

/**
 * Best-effort registrable domain. Deliberately simple — this drives host
 * classification, not security decisions (SSRF checks live in
 * features/ingestion/ssrf.ts and are IP-based, not name-based).
 */
export function registrableOf(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  // Handle the common two-label public suffixes (co.uk, com.au, …).
  const tail2 = parts.slice(-2).join(".");
  const TWO_LABEL = new Set(["co.uk", "com.au", "co.jp", "co.nz", "com.br", "co.in", "co.za"]);
  if (TWO_LABEL.has(tail2)) return parts.slice(-3).join(".");
  return tail2;
}

/**
 * Deduplicate results by registrable domain, keeping the highest-ranked one.
 * A vendor that occupies five of the top ten results is still one candidate.
 */
export function dedupeByDomain<T extends { url: string; position: number }>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const norm = normalizeDiscoveredUrl(item.url);
    if (!norm) continue;
    const existing = best.get(norm.domainKey);
    if (!existing || item.position < existing.position) best.set(norm.domainKey, item);
  }
  return [...best.values()].sort((a, b) => a.position - b.position);
}

/**
 * Extract a plausible product name from a search-result title.
 *
 * Titles are usually "Name — tagline" or "Name | tagline"; take the leading
 * segment and strip common marketing suffixes. This is a heuristic that feeds
 * ENTITY RESOLUTION, which verifies it — it is never trusted on its own.
 */
export function productNameFromTitle(title: string, host?: string): string {
  const head = title.split(/[|—–:·]/)[0].trim();
  const cleaned = head
    .replace(/\b(official site|official website|home ?page|home)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
  // Fall back to the domain label, which is a weaker but stable identifier.
  if (host) {
    const label = registrableOf(host).split(".")[0];
    if (label) return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return head.slice(0, 60);
}
