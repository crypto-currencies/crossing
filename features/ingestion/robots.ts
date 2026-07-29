/**
 * Robots + crawl policy.
 *
 * Before fetching any page for an entity, ingestion fetches and evaluates the
 * origin's robots.txt for the Crossing user-agent. Policy is FAIL-CLOSED: if the
 * policy cannot be safely determined (network/timeout/5xx), ingestion stops for
 * that origin rather than guessing. We never attempt to bypass access controls,
 * bot protection, login walls, or CAPTCHAs.
 *
 * Crawler identity + behavior are documented in docs/ingestion.md.
 */

import { safeFetch, CROSSING_USER_AGENT, type FetchPolicy, type FetchDeps } from "./fetcher";

/** Conservative minimum delay between requests to the same origin. */
export const DEFAULT_CRAWL_DELAY_MS = 1000;

const OUR_AGENT_TOKEN = "crossingbot";

export type CrawlPolicyStatus = "no_robots" | "rules" | "disallow_all" | "undetermined";

export interface CrawlPolicy {
  origin: string;
  fetchedAt: string;
  status: CrawlPolicyStatus;
  /** Disallow/allow path prefixes that apply to the Crossing agent. */
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  note: string;
}

interface AgentRules {
  disallow: string[];
  allow: string[];
  crawlDelay: number | null;
}

/** Parse robots.txt, returning the merged rules that apply to `agentToken`. */
export function parseRobots(text: string, agentToken = OUR_AGENT_TOKEN): AgentRules {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  // Group directives by the user-agent(s) they follow.
  const groups: { agents: string[]; rules: AgentRules }[] = [];
  let current: { agents: string[]; rules: AgentRules } | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { disallow: [], allow: [], crawlDelay: null } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow") current.rules.disallow.push(value);
    else if (field === "allow") current.rules.allow.push(value);
    else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.rules.crawlDelay = n;
    }
  }

  // Prefer a group naming our agent; else fall back to the wildcard group.
  const specific = groups.find((g) => g.agents.includes(agentToken));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const chosen = specific ?? wildcard;
  return chosen ? chosen.rules : { disallow: [], allow: [], crawlDelay: null };
}

/** robots.txt path matching: longest matching rule wins; Allow beats Disallow on ties. */
export function isPathAllowed(policy: Pick<CrawlPolicy, "status" | "disallow" | "allow">, path: string): boolean {
  if (policy.status === "undetermined") return false; // fail closed
  if (policy.status === "disallow_all") return false;

  const p = path || "/";
  const match = (rules: string[]): number => {
    let best = -1;
    for (const rule of rules) {
      if (rule === "") continue;
      if (p.startsWith(rule)) best = Math.max(best, rule.length);
    }
    return best;
  };
  const dis = match(policy.disallow);
  const allow = match(policy.allow);
  if (dis === -1) return true;
  return allow >= dis; // Allow of equal-or-greater specificity wins
}

/**
 * Fetch + evaluate robots.txt for an origin. Fail-closed on anything ambiguous.
 */
export async function fetchCrawlPolicy(
  origin: string,
  policy: FetchPolicy,
  deps: FetchDeps = {},
  now: Date = new Date()
): Promise<CrawlPolicy> {
  const fetchedAt = now.toISOString();
  const robotsUrl = new URL("/robots.txt", origin).toString();

  const result = await safeFetch(robotsUrl, { ...policy, allowedContentTypes: ["text/plain", "text/html"] }, deps);

  if (!result.ok) {
    // 404 → no robots.txt → crawling permitted (RFC 9309).
    if (result.error.status === 404) {
      return { origin, fetchedAt, status: "no_robots", disallow: [], allow: [], crawlDelayMs: DEFAULT_CRAWL_DELAY_MS, note: "no robots.txt (404) — permitted" };
    }
    // 5xx or unreachable → treat as fully disallowed / undetermined (fail closed).
    const undetermined = result.error.retryable || result.error.kind === "http_error";
    return {
      origin,
      fetchedAt,
      status: undetermined ? "undetermined" : "disallow_all",
      disallow: ["/"],
      allow: [],
      crawlDelayMs: DEFAULT_CRAWL_DELAY_MS,
      note: `robots.txt unavailable (${result.error.kind}${result.error.status ? " " + result.error.status : ""}) — failing closed`,
    };
  }

  const rules = parseRobots(result.body, OUR_AGENT_TOKEN);
  const disallowAll = rules.disallow.includes("/") && rules.allow.length === 0;
  const crawlDelayMs = Math.max(DEFAULT_CRAWL_DELAY_MS, (rules.crawlDelay ?? 0) * 1000);

  return {
    origin,
    fetchedAt,
    status: disallowAll ? "disallow_all" : rules.disallow.length || rules.allow.length ? "rules" : "no_robots",
    disallow: rules.disallow,
    allow: rules.allow,
    crawlDelayMs,
    note: `agent=${CROSSING_USER_AGENT.split("/")[0]} rules=${rules.disallow.length}D/${rules.allow.length}A`,
  };
}
