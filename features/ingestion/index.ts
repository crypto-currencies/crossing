/**
 * Public surface of the evidence-ingestion feature.
 *
 * Server-only. The first (and only) adapter is the official-site adapter. This
 * module never crawls on import; ingestion is triggered explicitly by the admin
 * route or the CLI (scripts/ingest.ts).
 */

export {
  APPROVED_SOURCES,
  OFFICIAL_SITE_ADAPTER_ID,
  listApprovedSources,
  listApprovedByCategory,
  getApprovedSource,
  resolveApprovedUrls,
  validateRegistry,
  approvedEntitySourceSchema,
  type ApprovedEntitySource,
} from "./registry";

export { safeFetch, CROSSING_USER_AGENT, type FetchPolicy, type FetchResult } from "./fetcher";
export { assertPublicHost, isBlockedIp, SsrfBlockedError } from "./ssrf";
export { fetchCrawlPolicy, parseRobots, isPathAllowed, type CrawlPolicy } from "./robots";
export { extractEvidence, EXTRACTION_VERSION, type ExtractedEvidence } from "./extract";
export { normalizePricing, type PricingModel } from "./pricing";
export { officialSiteAdapter, type SourceAdapter, type AdapterContext } from "./adapter";
export {
  ingestEntity,
  ingestCategory,
  ingestAll,
  DEFAULT_FRESH_WITHIN_MS,
  type IngestionOptions,
} from "./service";
export {
  InMemorySnapshotStore,
  FileSnapshotStore,
  getDefaultSnapshotStore,
  setDefaultSnapshotStore,
  type SnapshotStore,
} from "./store";
export {
  computeFreshness,
  fingerprint,
  type EvidenceSnapshot,
  type FreshnessStatus,
  type AttributeProvenance,
} from "./snapshot";
export {
  mergeOfficialEvidence,
  classifyEvidenceMode,
  enrichCorpusWithOfficialEvidence,
  isEnrichmentEnabled,
  MIN_OVERLAY_CONFIDENCE,
  type MergeResult,
} from "./merge";
export { RANKING_FACTUAL_ATTRIBUTES } from "./evidence";
export {
  buildAuditRows,
  buildEntityAudit,
  type EntityAuditRow,
  type EntityAuditDetail,
  type AttributeComparison,
} from "./audit";
export { resolveStoreKind } from "./store";
export { PrismaSnapshotStore } from "./prisma-store";
export {
  assessReadiness,
  type ReadinessVerdict,
  type ReadinessResult,
} from "./readiness";
export {
  mergeAllowed,
  mergeCategories,
  mergeEntities,
  anyMergeConfigured,
  getRefreshConfig,
  type RefreshConfig,
} from "./config";
export { applyConfiguredMerge } from "./enrich";
export {
  PILOT_ENTITIES,
  PILOT_MAPPING,
  getPilotSeedEntity,
  isPilotEntity,
  type PilotMapping,
} from "./pilot";
export {
  publicEvidenceNote,
  devEvidenceModeLabel,
  detailedModeFromReadiness,
} from "./evidence-mode";
export { PILOT_ENTITY_IDS } from "./registry";
export type {
  EvidenceMode,
  IngestionRunResult,
  EntityIngestionResult,
  IngestionDiagnostics,
} from "./types";
