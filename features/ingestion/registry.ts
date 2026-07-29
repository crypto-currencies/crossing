/**
 * Approved-domain registry — the ONLY source of URLs the ingestion pipeline may
 * fetch. Arbitrary or user-supplied URLs can never enter ingestion: a target is
 * eligible only if it belongs to an entry here AND falls within that entry's
 * approved origins (url-policy.ts).
 *
 * The initial set is a manually curated subset of the existing seeded software
 * entities (features/recommendation/fixtures.ts). Adding a domain is a
 * deliberate, reviewed edit to this file — see docs/ingestion.md.
 */

import { z } from "zod";
import { normalizeOrigin, parseHttpUrl } from "./url-policy";

export const OFFICIAL_SITE_ADAPTER_ID = "official-site";

export interface ApprovedEntitySource {
  /** Crossing entity id (matches features/recommendation/fixtures.ts). */
  entityId: string;
  canonicalName: string;
  /** Bare canonical domain, e.g. "glyphcode.dev". */
  canonicalDomain: string;
  categoryId: string;
  /** Origins any fetched URL must fall within (scheme + host [+ port]). */
  approvedOrigins: string[];
  homepageUrl: string;
  pricingUrl?: string;
  docsUrl?: string;
  featuresUrl?: string;
  /** Max link depth from a seed URL (this phase only fetches the listed URLs → depth 0). */
  allowedCrawlDepth: number;
  /** Hard cap on pages fetched per ingest run for this entity. */
  allowedPageCount: number;
  /** Permit subdomains of an approved host (docs.example.com for example.com). */
  allowSubdomains?: boolean;
  /** Permit a redirect that leaves the approved origin (default false). */
  allowOffOriginRedirect?: boolean;
  /** True for the real-vendor pilot entries (vs the fictional seed placeholders). */
  pilot?: boolean;
  /** Disabled entries are never ingested. */
  enabled: boolean;
}

export const approvedEntitySourceSchema = z.object({
  entityId: z.string().min(1).max(64),
  canonicalName: z.string().min(1).max(120),
  canonicalDomain: z.string().min(3).max(190),
  categoryId: z.string().min(1).max(64),
  approvedOrigins: z.array(z.string().url()).min(1).max(8),
  homepageUrl: z.string().url(),
  pricingUrl: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
  featuresUrl: z.string().url().optional(),
  allowedCrawlDepth: z.number().int().min(0).max(2),
  allowedPageCount: z.number().int().min(1).max(10),
  allowSubdomains: z.boolean().optional(),
  allowOffOriginRedirect: z.boolean().optional(),
  pilot: z.boolean().optional(),
  enabled: z.boolean(),
});

/**
 * Build a fictional-seed entry. These mirror the demo fixtures and are
 * DISABLED for ingestion by default — their domains are fictional and must never
 * be treated as official evidence. The real pilot entries (below) are the only
 * enabled sources.
 */
function official(
  entityId: string,
  canonicalName: string,
  canonicalDomain: string,
  categoryId: string,
  opts: { pricing?: boolean; docs?: boolean; features?: boolean; enabled?: boolean } = {}
): ApprovedEntitySource {
  const origin = `https://${canonicalDomain}`;
  return {
    entityId,
    canonicalName,
    canonicalDomain,
    categoryId,
    approvedOrigins: [origin],
    homepageUrl: `${origin}/`,
    pricingUrl: opts.pricing === false ? undefined : `${origin}/pricing`,
    docsUrl: opts.docs ? `${origin}/docs` : undefined,
    featuresUrl: opts.features ? `${origin}/features` : undefined,
    allowedCrawlDepth: 0,
    allowedPageCount: 4,
    allowSubdomains: false,
    allowOffOriginRedirect: false,
    pilot: false,
    enabled: opts.enabled ?? false,
  };
}

/**
 * Curated initial registry (~13 entities across the 7 MVP categories). Domains
 * mirror the seeded fixtures; they are fictional demo domains, so live ingestion
 * in development will surface DNS/fetch errors in the audit tool — which is the
 * point of the audit tool. Tests exercise the pipeline with local HTML fixtures.
 */
export const APPROVED_SOURCES: ApprovedEntitySource[] = [
  official("glyph-code", "Glyph Code", "glyphcode.dev", "developer-tools", { docs: true }),
  official("vellum-editor", "Vellum Editor", "vellum.tools", "developer-tools"),
  official("forge-ide", "Forge IDE", "forge-ide.io", "developer-tools", { docs: true }),
  official("cortex-write", "Cortex Write", "cortexwrite.ai", "ai-tools"),
  official("nimbus-ai", "Nimbus AI", "nimbus.ai", "ai-tools"),
  official("tandem-tasks", "Tandem Tasks", "tandemtasks.com", "productivity-tools"),
  official("beacon-pm", "Beacon PM", "beaconpm.io", "productivity-tools", { features: true }),
  official("canvas-forge", "Canvas Forge", "canvasforge.com", "design-tools"),
  official("driftdeploy", "DriftDeploy", "driftdeploy.com", "hosting-platforms", { docs: true }),
  official("helmport", "Helmport", "helmport.io", "hosting-platforms", { docs: true }),
  official("postwright", "Postwright", "postwright.com", "email-platforms"),
  official("tally-metrics", "Tally Metrics", "tallymetrics.com", "analytics-tools", { docs: true }),
  official("northwind-analytics", "Northwind Analytics", "northwindanalytics.com", "analytics-tools"),

  // ── Real pilot (analytics-tools) — the ONLY enabled sources. ──
  // These are real vendors with correct identities, NOT the fictional seeds. See
  // features/ingestion/pilot.ts for the seed↔real mapping and rationale.
  {
    entityId: "plausible-analytics",
    canonicalName: "Plausible Analytics",
    canonicalDomain: "plausible.io",
    categoryId: "analytics-tools",
    approvedOrigins: ["https://plausible.io"],
    homepageUrl: "https://plausible.io/",
    docsUrl: "https://plausible.io/docs",
    allowedCrawlDepth: 0,
    allowedPageCount: 3,
    allowSubdomains: false,
    allowOffOriginRedirect: false,
    pilot: true,
    enabled: true,
  },
  {
    entityId: "fathom-analytics",
    canonicalName: "Fathom Analytics",
    canonicalDomain: "usefathom.com",
    categoryId: "analytics-tools",
    approvedOrigins: ["https://usefathom.com"],
    homepageUrl: "https://usefathom.com/",
    pricingUrl: "https://usefathom.com/pricing",
    allowedCrawlDepth: 0,
    allowedPageCount: 3,
    allowSubdomains: false,
    allowOffOriginRedirect: false,
    pilot: true,
    enabled: true,
  },
  {
    entityId: "matomo",
    canonicalName: "Matomo",
    canonicalDomain: "matomo.org",
    categoryId: "analytics-tools",
    approvedOrigins: ["https://matomo.org"],
    homepageUrl: "https://matomo.org/",
    pricingUrl: "https://matomo.org/pricing/",
    allowedCrawlDepth: 0,
    allowedPageCount: 3,
    allowSubdomains: false,
    allowOffOriginRedirect: false,
    pilot: true,
    enabled: true,
  },
];

/** The three enabled real pilot entity ids. */
export const PILOT_ENTITY_IDS = ["plausible-analytics", "fathom-analytics", "matomo"] as const;

const BY_ID = new Map(APPROVED_SOURCES.map((s) => [s.entityId, s]));

export function listApprovedSources(includeDisabled = false): ApprovedEntitySource[] {
  return includeDisabled ? APPROVED_SOURCES : APPROVED_SOURCES.filter((s) => s.enabled);
}

export function getApprovedSource(entityId: string): ApprovedEntitySource | undefined {
  return BY_ID.get(entityId);
}

export function listApprovedByCategory(categoryId: string, includeDisabled = false): ApprovedEntitySource[] {
  return listApprovedSources(includeDisabled).filter((s) => s.categoryId === categoryId);
}

/** The concrete page URLs to fetch for an entity, capped by allowedPageCount. */
export function resolveApprovedUrls(source: ApprovedEntitySource): string[] {
  const urls = [source.homepageUrl, source.pricingUrl, source.docsUrl, source.featuresUrl]
    .filter((u): u is string => typeof u === "string")
    // Defense-in-depth: each configured URL must itself be within an approved origin.
    .filter((u) => source.approvedOrigins.some((o) => {
      const a = normalizeOrigin(o);
      const b = normalizeOrigin(u);
      return a && b && a.host === b.host && a.protocol === b.protocol && a.port === b.port;
    }));
  return [...new Set(urls)].slice(0, source.allowedPageCount);
}

/**
 * Validate the entire registry (shape + parseable origins/URLs). Throws on the
 * first problem. Exercised by a test so a bad edit fails CI, not production.
 */
export function validateRegistry(sources: ApprovedEntitySource[] = APPROVED_SOURCES): void {
  const ids = new Set<string>();
  for (const s of sources) {
    approvedEntitySourceSchema.parse(s);
    if (ids.has(s.entityId)) throw new Error(`duplicate registry entityId: ${s.entityId}`);
    ids.add(s.entityId);
    for (const origin of s.approvedOrigins) {
      if (!parseHttpUrl(origin)) throw new Error(`invalid approved origin for ${s.entityId}: ${origin}`);
    }
    if (resolveApprovedUrls(s).length === 0) {
      throw new Error(`registry entry ${s.entityId} has no fetchable URLs within its approved origins`);
    }
  }
}
