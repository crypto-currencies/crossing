import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/server/admin";
import { isAdmin } from "@/lib/server/auth";
import { ingestionToolEnabled, isProduction } from "@/features/ingestion/access";
import { getDefaultSnapshotStore } from "@/features/ingestion/store";
import { buildEntityAudit } from "@/features/ingestion/audit";
import { EvidenceActions } from "@/components/admin/evidence-actions";

export const metadata: Metadata = {
  title: "Evidence detail",
  robots: { index: false, follow: false },
};

function fmt(v: string | number | boolean | undefined): string {
  if (v === undefined) return "—";
  return String(v);
}

export default async function EvidenceDetailPage({ params }: { params: Promise<{ entityId: string }> }) {
  if (!ingestionToolEnabled()) notFound();
  if (isProduction()) {
    const user = await getAdminUser();
    if (!user || !isAdmin(user)) notFound();
  }

  const { entityId } = await params;
  const store = getDefaultSnapshotStore();
  const detail = await buildEntityAudit(entityId, store);
  if (!detail) notFound();

  const { row, source, latest, latestValid, history, comparisons, conflicts, rankingFieldsAffected, rankingFieldsNotAffected, warnings, readiness, robotsStatus } = detail;

  return (
    <div className="ev-wrap">
      <Link href="/control/admin/evidence" className="ev-back">← All entities</Link>
      <div className="ev-head">
        <h1>
          {row.canonicalName}
          {row.pilot ? <span className="ev-badge ev-mode-mixed" style={{ marginLeft: "0.5rem", verticalAlign: "middle" }}>pilot</span> : null}
        </h1>
        <p>
          {row.categoryName} · <span className={`ev-badge ev-mode-${row.evidenceMode}`}>{row.evidenceMode}</span> ·
          {" "}freshness <span className={`ev-fresh-${row.freshness}`}>{row.freshness}</span> ·
          {" "}confidence {row.extractionConfidence != null ? row.extractionConfidence.toFixed(2) : "—"}
        </p>
      </div>

      {/* Readiness verdict */}
      <section className="ev-section">
        <h2>Readiness</h2>
        <p>
          <span className={`ev-badge ev-ready-${readiness.verdict}`}>{readiness.verdict}</span>
          {readiness.promotable ? <span className="ev-verdict-match" style={{ marginLeft: "0.6rem" }}>promotable</span> : null}
        </p>
        <ul>{readiness.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <dl className="ev-kv" style={{ marginTop: "0.6rem" }}>
          <dt>Robots status</dt><dd className={robotsStatus === "blocked" ? "ev-yes" : ""}>{robotsStatus}</dd>
          <dt>Official source URLs</dt><dd>{row.sourceUrls.join(", ") || "—"}</dd>
          <dt>Last attempted</dt><dd>{row.lastIngestAt ? new Date(row.lastIngestAt).toISOString() : "never"}</dd>
          <dt>Last successful</dt><dd>{row.lastSuccessAt ? new Date(row.lastSuccessAt).toISOString() : "never"}</dd>
          <dt>Latest valid snapshot</dt><dd className="ev-fp">{latestValid?.id ?? "none"}</dd>
        </dl>
      </section>

      {/* Approved source config */}
      <section className="ev-section">
        <h2>Approved source configuration</h2>
        {source ? (
          <dl className="ev-kv">
            <dt>Entity ID</dt><dd>{source.entityId}</dd>
            <dt>Canonical domain</dt><dd>{source.canonicalDomain}</dd>
            <dt>Approved origins</dt><dd>{source.approvedOrigins.join(", ")}</dd>
            <dt>Homepage</dt><dd>{source.homepageUrl}</dd>
            <dt>Pricing URL</dt><dd>{source.pricingUrl ?? "—"}</dd>
            <dt>Docs URL</dt><dd>{source.docsUrl ?? "—"}</dd>
            <dt>Features URL</dt><dd>{source.featuresUrl ?? "—"}</dd>
            <dt>Crawl depth / page cap</dt><dd>{source.allowedCrawlDepth} / {source.allowedPageCount}</dd>
            <dt>Subdomains / off-origin redirect</dt><dd>{String(!!source.allowSubdomains)} / {String(!!source.allowOffOriginRedirect)}</dd>
            <dt>Enabled</dt><dd>{String(source.enabled)}</dd>
          </dl>
        ) : (
          <p className="ev-no">This entity is not in the approved registry.</p>
        )}
        {source && <EvidenceActions scope="entity" target={source.entityId} allowRefresh />}
      </section>

      {/* Latest evidence */}
      <section className="ev-section">
        <h2>Latest evidence</h2>
        {latest ? (
          <>
            <dl className="ev-kv">
              <dt>Snapshot ID</dt><dd className="ev-fp">{latest.id}</dd>
              <dt>Retrieved</dt><dd>{new Date(latest.retrievedAt).toISOString()}</dd>
              <dt>Status</dt><dd>{latest.ok ? "ok" : `failed — ${latest.error?.kind ?? "unknown"}`}</dd>
              <dt>Extraction version</dt><dd>{latest.extractionVersion}</dd>
              <dt>Content fingerprint</dt><dd className="ev-fp">{latest.contentFingerprint}</dd>
              <dt>Pricing model</dt>
              <dd>
                {latest.pricing.kind}
                {latest.pricing.minMonthly != null ? ` · ${latest.pricing.currency ?? ""} ${latest.pricing.minMonthly}/mo` : ""}
                {latest.pricing.supportingText.length ? <span className="ev-excerpt">{latest.pricing.supportingText.join(" · ")}</span> : null}
              </dd>
            </dl>
            <h2 style={{ marginTop: "1rem" }}>Pages fetched</h2>
            <div className="ev-scroll">
              <table className="ev-table">
                <thead><tr><th>URL</th><th>OK</th><th>Status</th><th>Bytes</th><th>Fingerprint / error</th></tr></thead>
                <tbody>
                  {latest.pages.map((p, i) => (
                    <tr key={i}>
                      <td>{p.url}</td>
                      <td className={p.ok ? "ev-verdict-match" : "ev-yes"}>{p.ok ? "yes" : "no"}</td>
                      <td>{p.status ?? "—"}</td>
                      <td>{p.bytes ?? "—"}</td>
                      <td className="ev-fp">{p.ok ? p.contentFingerprint : `${p.error?.kind}: ${p.error?.message}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="ev-no">Never ingested. Run a dry-run or refresh above.</p>
        )}
      </section>

      {/* Attribute provenance / comparison */}
      <section className="ev-section">
        <h2>Seed vs. official (attribute provenance)</h2>
        <div className="ev-scroll">
          <table className="ev-table">
            <thead>
              <tr><th>Attribute</th><th>Ranking?</th><th>Seed value</th><th>Official</th><th>Verdict</th><th>Method</th><th>Conf.</th><th>Source</th></tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr key={c.attribute}>
                  <td>{c.attribute}</td>
                  <td className={c.rankingField ? "ev-verdict-official-only" : "ev-no"}>{c.rankingField ? "yes" : "—"}</td>
                  <td>{fmt(c.seedValue)}</td>
                  <td>
                    {c.officialState === "value" ? (
                      fmt(c.officialValue)
                    ) : c.officialState === "not-found" ? (
                      <span className="ev-no">not found (unknown)</span>
                    ) : c.officialState === "ingest-failed" ? (
                      <span className="ev-yes">extraction failed</span>
                    ) : (
                      <span className="ev-no">never ingested</span>
                    )}
                    {c.sourceText ? <span className="ev-excerpt">{c.sourceText}</span> : null}
                  </td>
                  <td className={`ev-verdict-${c.verdict}`}>{c.verdict}</td>
                  <td>{c.method ?? "—"}</td>
                  <td>{c.confidence != null ? c.confidence.toFixed(2) : "—"}</td>
                  <td className="ev-fp">{c.sourceUrl ?? "—"}{c.fingerprint ? ` · ${c.fingerprint.slice(0, 10)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ranking impact */}
      <section className="ev-section">
        <h2>Ranking fields</h2>
        <dl className="ev-kv">
          <dt>Affected (official-backed)</dt><dd>{rankingFieldsAffected.length ? rankingFieldsAffected.join(", ") : "none"}</dd>
          <dt>Not affected (still seeded)</dt><dd>{rankingFieldsNotAffected.length ? rankingFieldsNotAffected.join(", ") : "none"}</dd>
        </dl>
        {conflicts.length > 0 && (
          <>
            <h2 style={{ marginTop: "1rem" }}>Conflicts</h2>
            <ul>
              {conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{c.attribute}</strong>: seed <code>{fmt(c.seedValue)}</code> vs official <code>{fmt(c.officialValue)}</code> — resolved to <strong>{c.resolution}</strong> ({c.reason})
                </li>
              ))}
            </ul>
          </>
        )}
        {warnings.length > 0 && (
          <>
            <h2 style={{ marginTop: "1rem" }}>Warnings</h2>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </>
        )}
      </section>

      {/* Snapshot history */}
      <section className="ev-section">
        <h2>Snapshot history ({history.length})</h2>
        <div className="ev-scroll">
          <table className="ev-table">
            <thead><tr><th>Retrieved</th><th>Status</th><th>Fingerprint</th><th>Pages ok/fail</th><th>Confidence</th></tr></thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.retrievedAt).toISOString()}</td>
                  <td className={s.ok ? "ev-verdict-match" : "ev-yes"}>{s.ok ? "ok" : `failed (${s.error?.kind})`}</td>
                  <td className="ev-fp">{s.contentFingerprint.slice(0, 16)}</td>
                  <td>{s.http.pagesFetched}/{s.http.pagesFailed}</td>
                  <td>{s.confidence.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.length === 0 && <p className="ev-no">No snapshots yet.</p>}
      </section>
    </div>
  );
}
