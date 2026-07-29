import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/server/admin";
import { isAdmin } from "@/lib/server/auth";
import { ingestionToolEnabled, isProduction } from "@/features/ingestion/access";
import { getDefaultSnapshotStore } from "@/features/ingestion/store";
import { buildAuditRows, type EntityAuditRow } from "@/features/ingestion/audit";
import { classifyStoreError, type StoreHealthProblem } from "@/features/ingestion/store-health";
import { EvidenceActions } from "@/components/admin/evidence-actions";

export const metadata: Metadata = {
  title: "Evidence audit",
  // No public indexing.
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;

function one(sp: SP, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function applyFilters(rows: EntityAuditRow[], sp: SP): EntityAuditRow[] {
  const category = one(sp, "category");
  const freshness = one(sp, "freshness");
  const mode = one(sp, "mode");
  const conflicts = one(sp, "conflicts");
  const missing = one(sp, "missing");
  const failed = one(sp, "failed");

  const readiness = one(sp, "readiness");
  const pilot = one(sp, "pilot");

  return rows.filter((r) => {
    if (category && r.categoryId !== category) return false;
    if (freshness && r.freshness !== freshness) return false;
    if (mode && r.evidenceMode !== mode) return false;
    if (readiness && r.readiness !== readiness) return false;
    if (conflicts === "1" && !r.hasConflicts) return false;
    if (missing === "1" && r.missingFactualFields.length === 0) return false;
    if (failed === "1" && !r.failed) return false;
    if (pilot === "1" && !r.pilot) return false;
    return true;
  });
}

export default async function EvidenceAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!ingestionToolEnabled()) notFound();
  if (isProduction()) {
    const user = await getAdminUser();
    if (!user || !isAdmin(user)) notFound();
  }

  const sp = await searchParams;

  // The snapshot store may be unmigrated or unreachable. Surface that as an
  // actionable operator message instead of a raw Prisma error overlay.
  let allRows: EntityAuditRow[] = [];
  let problem: StoreHealthProblem | null = null;
  try {
    allRows = await buildAuditRows(getDefaultSnapshotStore());
  } catch (err) {
    problem = classifyStoreError(err);
    if (!problem) throw err; // genuinely unexpected — let the error boundary handle it
  }

  if (problem) {
    return (
      <div className="ev-wrap">
        <div className="ev-head">
          <h1>Evidence audit</h1>
        </div>
        <section className="ev-section" role="alert">
          <h2>{problem.title}</h2>
          <p className="ev-empty" style={{ textAlign: "left", padding: "0.5rem 0" }}>
            {problem.detail}
          </p>
          <p className="ev-result">
            <strong>Fix:</strong> {problem.remedy}
          </p>
        </section>
      </div>
    );
  }

  const rows = applyFilters(allRows, sp);

  const categories = [...new Map(allRows.map((r) => [r.categoryId, r.categoryName])).entries()];
  const counts = {
    live: allRows.filter((r) => r.evidenceMode === "live").length,
    mixed: allRows.filter((r) => r.evidenceMode === "mixed").length,
    seeded: allRows.filter((r) => r.evidenceMode === "seeded").length,
    failed: allRows.filter((r) => r.failed).length,
    conflicts: allRows.filter((r) => r.hasConflicts).length,
  };

  return (
    <div className="ev-wrap">
      <div className="ev-head">
        <h1>Evidence audit</h1>
        <p>
          Compare each seeded entity&rsquo;s factual attributes against the latest official-site
          evidence before live evidence influences ranking. Read-only; ingestion runs out of band.
        </p>
        <span className="ev-devbanner">
          {isProduction() ? "Admin-only tool" : "Development tool"} · not indexed · seeded vs official
        </span>
      </div>

      <div className="ev-summary">
        <div className="ev-stat"><b>{allRows.length}</b><span>entities</span></div>
        <div className="ev-stat"><b>{counts.live}</b><span>live facts</span></div>
        <div className="ev-stat"><b>{counts.mixed}</b><span>mixed</span></div>
        <div className="ev-stat"><b>{counts.seeded}</b><span>seed-only</span></div>
        <div className="ev-stat"><b>{counts.conflicts}</b><span>with conflicts</span></div>
        <div className="ev-stat"><b>{counts.failed}</b><span>failed ingest</span></div>
      </div>

      <form className="ev-filters" method="get">
        <label>
          Category
          <select name="category" defaultValue={one(sp, "category")}>
            <option value="">All</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Freshness
          <select name="freshness" defaultValue={one(sp, "freshness")}>
            <option value="">Any</option>
            <option value="fresh">Fresh</option>
            <option value="aging">Aging</option>
            <option value="stale">Stale</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          Evidence mode
          <select name="mode" defaultValue={one(sp, "mode")}>
            <option value="">Any</option>
            <option value="live">Live</option>
            <option value="mixed">Mixed</option>
            <option value="seeded">Seed-only</option>
          </select>
        </label>
        <label>
          Conflicts
          <select name="conflicts" defaultValue={one(sp, "conflicts")}>
            <option value="">Any</option>
            <option value="1">Has conflicts</option>
          </select>
        </label>
        <label>
          Missing evidence
          <select name="missing" defaultValue={one(sp, "missing")}>
            <option value="">Any</option>
            <option value="1">Missing factual fields</option>
          </select>
        </label>
        <label>
          Failed ingest
          <select name="failed" defaultValue={one(sp, "failed")}>
            <option value="">Any</option>
            <option value="1">Failed</option>
          </select>
        </label>
        <label>
          Readiness
          <select name="readiness" defaultValue={one(sp, "readiness")}>
            <option value="">Any</option>
            <option value="ready">Ready</option>
            <option value="mixed">Mixed</option>
            <option value="needs-review">Needs review</option>
            <option value="blocked-by-conflict">Blocked by conflict</option>
            <option value="stale">Stale</option>
            <option value="ingestion-failed">Ingestion failed</option>
            <option value="not-ingested">Not ingested</option>
          </select>
        </label>
        <label>
          Pilot only
          <select name="pilot" defaultValue={one(sp, "pilot")}>
            <option value="">Any</option>
            <option value="1">Pilot entities</option>
          </select>
        </label>
        <button type="submit">Apply</button>
        <Link href="/control/admin/evidence">Clear</Link>
      </form>

      <div style={{ marginBottom: "1rem" }}>
        <EvidenceActions scope="all" allowRefresh />
      </div>

      <div className="ev-scroll">
        <table className="ev-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Category</th>
              <th>Readiness</th>
              <th>Mode</th>
              <th>Robots</th>
              <th>Last success</th>
              <th>Freshness</th>
              <th>Conflicts</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entityId}>
                <td>
                  <Link href={`/control/admin/evidence/${r.entityId}`}>{r.canonicalName}</Link>
                  {r.pilot ? <span className="ev-badge ev-mode-mixed" style={{ marginLeft: "0.4rem" }}>pilot</span> : null}
                </td>
                <td>{r.categoryName}</td>
                <td><span className={`ev-badge ev-ready-${r.readiness}`}>{r.readiness}</span></td>
                <td><span className={`ev-badge ev-mode-${r.evidenceMode}`}>{r.evidenceMode}</span></td>
                <td className={r.robotsStatus === "blocked" ? "ev-yes" : "ev-no"}>{r.robotsStatus}</td>
                <td>{r.lastSuccessAt ? new Date(r.lastSuccessAt).toISOString().slice(0, 10) : "—"}</td>
                <td className={`ev-fresh-${r.freshness}`}>{r.freshness}</td>
                <td className={r.hasConflicts ? "ev-yes" : "ev-no"}>{r.hasConflicts ? "yes" : "—"}</td>
                <td className={r.missingFactualFields.length ? "ev-yes" : "ev-no"}>
                  {r.missingFactualFields.length ? r.missingFactualFields.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="ev-empty">No entities match these filters.</p>}
      </div>
    </div>
  );
}
