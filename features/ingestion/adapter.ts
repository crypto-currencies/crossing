/**
 * Source-adapter interface + the first implementation (official site).
 *
 * An adapter validates a source config, fetches + extracts within policy,
 * normalizes to evidence, computes source-specific confidence, and reports its
 * attribution requirements + error classification. The ingestion service
 * orchestrates dedup / storage / freshness across adapters — an adapter only
 * knows how to turn ONE approved source into ONE snapshot.
 *
 * Only the official-site adapter exists in this phase. No empty stubs for future
 * services are added prematurely.
 */

import { randomUUID } from "node:crypto";
import { safeFetch, type FetchDeps, type FetchPolicy } from "./fetcher";
import { fetchCrawlPolicy, isPathAllowed, DEFAULT_CRAWL_DELAY_MS } from "./robots";
import { extractEvidence, EXTRACTION_VERSION } from "./extract";
import { normalizeExtractions } from "./evidence";
import { computeFreshness, fingerprint, type EvidenceSnapshot, type PageResult } from "./snapshot";
import { resolveApprovedUrls, approvedEntitySourceSchema, OFFICIAL_SITE_ADAPTER_ID, type ApprovedEntitySource } from "./registry";
import type { IngestionDiagnostics } from "./types";

export interface AdapterContext {
  now?: Date;
  jobId?: string;
  fetchDeps?: FetchDeps;
  /** Injected in tests to skip real crawl-delay sleeps. */
  sleep?: (ms: number) => Promise<void>;
}

export interface AdapterRunResult {
  snapshot: EvidenceSnapshot;
  diagnostics: IngestionDiagnostics;
}

export interface SourceAdapter {
  readonly id: string;
  readonly attribution: { requiresAttribution: boolean; note: string };
  validateConfig(source: ApprovedEntitySource): void;
  run(source: ApprovedEntitySource, ctx?: AdapterContext): Promise<AdapterRunResult>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function failedSnapshot(
  source: ApprovedEntitySource,
  retrievedAt: string,
  now: Date,
  pages: PageResult[],
  error: { kind: string; message: string }
): EvidenceSnapshot {
  return {
    id: `${source.entityId}:${retrievedAt}:failed`,
    entityId: source.entityId,
    adapterId: OFFICIAL_SITE_ADAPTER_ID,
    primarySourceUrl: source.homepageUrl,
    retrievedAt,
    extractionVersion: EXTRACTION_VERSION,
    ok: false,
    http: {
      pagesFetched: pages.filter((p) => p.ok).length,
      pagesFailed: pages.filter((p) => !p.ok).length,
      totalBytes: pages.reduce((s, p) => s + (p.bytes ?? 0), 0),
      totalDurationMs: pages.reduce((s, p) => s + (p.durationMs ?? 0), 0),
    },
    contentFingerprint: fingerprint({ error }),
    attributes: {},
    pricing: { kind: "unknown", minMonthly: null, currency: null, hasFreePlan: null, hasFreeTrial: null, confidence: 0, supportingText: [] },
    provenance: [],
    confidence: 0,
    freshnessStatus: computeFreshness(retrievedAt, now),
    pages,
    warnings: [],
    error,
  };
}

export const officialSiteAdapter: SourceAdapter = {
  id: OFFICIAL_SITE_ADAPTER_ID,
  attribution: {
    requiresAttribution: false,
    note: "Facts are sourced from the vendor's own official website; no third-party attribution required.",
  },

  validateConfig(source: ApprovedEntitySource): void {
    approvedEntitySourceSchema.parse(source);
    if (resolveApprovedUrls(source).length === 0) {
      throw new Error(`no fetchable URLs within approved origins for ${source.entityId}`);
    }
  },

  async run(source: ApprovedEntitySource, ctx: AdapterContext = {}): Promise<AdapterRunResult> {
    const now = ctx.now ?? new Date();
    const jobId = ctx.jobId ?? randomUUID();
    const retrievedAt = now.toISOString();
    const sleep = ctx.sleep ?? realSleep;

    const fetchPolicy: FetchPolicy = {
      approvedOrigins: source.approvedOrigins,
      allowSubdomains: source.allowSubdomains,
      allowOffOriginRedirect: source.allowOffOriginRedirect,
    };

    const diagnostics: IngestionDiagnostics = {
      jobId,
      entityId: source.entityId,
      adapterId: OFFICIAL_SITE_ADAPTER_ID,
      urlsAttempted: [],
      urlsBlocked: [],
      robotsStatus: "skipped",
      fetchDurationMs: 0,
      totalBytes: 0,
      pagesOk: 0,
      pagesFailed: 0,
      snapshotOutcome: "failed",
      warnings: [],
      errorClassification: null,
    };

    // ── Robots first (fail-closed) ──
    const origin = source.approvedOrigins[0];
    const policy = await fetchCrawlPolicy(origin, fetchPolicy, ctx.fetchDeps, now);
    diagnostics.robotsStatus = policy.status;
    if (policy.status === "undetermined" || policy.status === "disallow_all") {
      diagnostics.errorClassification = "robots_blocked";
      const snap = failedSnapshot(source, retrievedAt, now, [], { kind: "robots_blocked", message: policy.note });
      return { snapshot: snap, diagnostics };
    }

    const urls = resolveApprovedUrls(source);
    const pages: PageResult[] = [];
    const extractions: { url: string; evidence: ReturnType<typeof extractEvidence> }[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const path = new URL(url).pathname;
      if (!isPathAllowed(policy, path)) {
        diagnostics.urlsBlocked.push(url);
        pages.push({ url, ok: false, error: { kind: "robots_disallow", message: "disallowed by robots.txt", retryable: false } });
        diagnostics.pagesFailed++;
        continue;
      }

      diagnostics.urlsAttempted.push(url);
      const res = await safeFetch(url, fetchPolicy, ctx.fetchDeps);
      if (!res.ok) {
        pages.push({ url, ok: false, error: res.error });
        diagnostics.pagesFailed++;
        diagnostics.errorClassification = diagnostics.errorClassification ?? res.error.kind;
        continue;
      }

      diagnostics.pagesOk++;
      diagnostics.totalBytes += res.bytes;
      diagnostics.fetchDurationMs += res.durationMs;
      pages.push({
        url: res.finalUrl,
        ok: true,
        status: res.status,
        bytes: res.bytes,
        durationMs: res.durationMs,
        contentFingerprint: fingerprint(res.body),
      });
      extractions.push({ url: res.finalUrl, evidence: extractEvidence(res.body, { url: res.finalUrl, httpLastModified: res.lastModified }) });

      if (i < urls.length - 1) await sleep(policy.crawlDelayMs || DEFAULT_CRAWL_DELAY_MS);
    }

    if (diagnostics.pagesOk === 0) {
      diagnostics.errorClassification = diagnostics.errorClassification ?? "all_pages_failed";
      const snap = failedSnapshot(source, retrievedAt, now, pages, {
        kind: diagnostics.errorClassification,
        message: "no page could be fetched or extracted",
      });
      return { snapshot: snap, diagnostics };
    }

    const normalized = normalizeExtractions(extractions);
    const contentFingerprint = fingerprint({ attributes: normalized.attributes, pricing: normalized.pricing });
    const warnings: string[] = [];
    if (diagnostics.pagesFailed > 0) warnings.push(`${diagnostics.pagesFailed} page(s) failed or were blocked.`);
    if (normalized.pricing.kind === "unknown") warnings.push("Pricing could not be confidently normalized; stored as unknown.");
    diagnostics.warnings = warnings;

    const snapshot: EvidenceSnapshot = {
      id: `${source.entityId}:${retrievedAt}:${contentFingerprint.slice(0, 8)}`,
      entityId: source.entityId,
      adapterId: OFFICIAL_SITE_ADAPTER_ID,
      primarySourceUrl: source.homepageUrl,
      retrievedAt,
      extractionVersion: EXTRACTION_VERSION,
      ok: true,
      http: {
        pagesFetched: diagnostics.pagesOk,
        pagesFailed: diagnostics.pagesFailed,
        totalBytes: diagnostics.totalBytes,
        totalDurationMs: diagnostics.fetchDurationMs,
      },
      contentFingerprint,
      attributes: normalized.attributes,
      pricing: normalized.pricing,
      provenance: normalized.provenance,
      confidence: normalized.confidence,
      freshnessStatus: computeFreshness(retrievedAt, now),
      pages,
      warnings,
      error: null,
    };

    return { snapshot, diagnostics };
  },
};
