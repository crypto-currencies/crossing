/**
 * SSRF / private-network protection for the ingestion fetcher.
 *
 * The fetcher must never be tricked into reaching internal infrastructure. This
 * module classifies IP literals and resolved hostnames as public or blocked,
 * covering loopback, private (RFC1918), link-local (incl. the cloud metadata
 * endpoint 169.254.169.254 / fd00:ec2::254), CGNAT, ULA, documentation, and
 * multicast/reserved ranges — for both IPv4 and IPv6 (including IPv4-mapped v6).
 *
 * DNS rebinding: `assertPublicHost` resolves ALL A/AAAA records and blocks if
 * ANY is non-public, then the caller connects immediately. Full pin-to-IP
 * (eliminating the resolve→connect race entirely) is a documented limitation.
 */

export class SsrfBlockedError extends Error {
  constructor(
    public readonly host: string,
    public readonly detail: string
  ) {
    super(`blocked host "${host}": ${detail}`);
    this.name = "SsrfBlockedError";
  }
}

/** Node's dns.lookup shape, injectable for tests. */
export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

// ─── IPv4 ─────────────────────────────────────────────────────────────────────

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/** True for any IPv4 address that must never be fetched. */
export function isBlockedIpv4(ip: string): boolean {
  const o = parseIpv4(ip);
  if (!o) return false;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0 && o[2] === 0) return true; // 192.0.0.0/24 IETF
  if (a === 192 && b === 0 && o[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51 && o[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && o[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

// ─── IPv6 ─────────────────────────────────────────────────────────────────────

/** Expand an IPv6 address to eight 16-bit hextet numbers, or null if malformed. */
function parseIpv6(ip: string): number[] | null {
  let s = ip.trim().toLowerCase();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  // Zone id (e.g. %eth0) — strip for classification.
  const pct = s.indexOf("%");
  if (pct !== -1) s = s.slice(0, pct);
  if (!s.includes(":")) return null;

  // Handle embedded IPv4 (e.g. ::ffff:1.2.3.4) by converting the tail.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const hi = (v4[0] << 8) | v4[1];
    const lo = (v4[2] << 8) | v4[3];
    s = `${s.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const gs = part.split(":");
    const out: number[] = [];
    for (const g of gs) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  if (halves.length === 2) {
    const head = toGroups(halves[0]);
    const tailG = toGroups(halves[1]);
    if (!head || !tailG) return null;
    const fill = 8 - head.length - tailG.length;
    if (fill < 0) return null;
    return [...head, ...Array(fill).fill(0), ...tailG];
  }
  const groups = toGroups(s);
  if (!groups || groups.length !== 8) return null;
  return groups;
}

export function isBlockedIpv6(ip: string): boolean {
  const g = parseIpv6(ip);
  if (!g) return false;
  const isZero = g.every((x) => x === 0);
  if (isZero) return true; // ::
  // ::1 loopback
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true;
  const first = g[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local (incl. fd00:ec2::254)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  // IPv4-mapped ::ffff:0:0/96 — classify by the embedded v4.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedIpv4(v4);
  }
  return false;
}

/** True when an IP literal (v4 or v6) must not be fetched. */
export function isBlockedIp(ip: string): boolean {
  if (parseIpv4(ip)) return isBlockedIpv4(ip);
  return isBlockedIpv6(ip);
}

function looksLikeIp(host: string): boolean {
  return parseIpv4(host) !== null || host.includes(":");
}

/**
 * Ensure a hostname (or IP literal) is safe to fetch. IP literals are checked
 * directly; hostnames are resolved and EVERY returned address must be public.
 * Throws SsrfBlockedError on any block or resolution failure.
 */
export async function assertPublicHost(hostname: string, lookup: LookupFn): Promise<void> {
  const host = hostname.trim().toLowerCase();
  if (host === "" ) throw new SsrfBlockedError(host, "empty host");
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new SsrfBlockedError(host, "localhost is not fetchable");
  }

  if (looksLikeIp(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError(host, "IP literal is in a blocked range");
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new SsrfBlockedError(host, "DNS resolution failed");
  }
  if (!addresses || addresses.length === 0) {
    throw new SsrfBlockedError(host, "DNS returned no addresses");
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new SsrfBlockedError(host, `resolved to a blocked address ${address}`);
    }
  }
}
