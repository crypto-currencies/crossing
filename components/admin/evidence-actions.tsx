"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  scope: "entity" | "category" | "all";
  target?: string;
  /** Whether refresh (non-dry-run) is offered. Dry-run is always available. */
  allowRefresh: boolean;
}

/**
 * Manual refresh / dry-run trigger. Posts to the protected ingestion route.
 * Never renders raw page content — only a short structured summary.
 */
export function EvidenceActions({ scope, target, allowRefresh }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "dry" | "refresh">(null);
  const [message, setMessage] = useState<string>("");

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "dry" : "refresh");
    setMessage("");
    try {
      const res = await fetch("/api/admin/ingestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, target, dryRun, force: !dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
        deduplicated?: number;
        failed?: number;
        skippedFresh?: number;
        requested?: number;
      };
      if (!res.ok) {
        setMessage(`Failed: ${data.error ?? res.status}`);
      } else {
        setMessage(
          `${dryRun ? "Dry-run" : "Refresh"} done — ${data.created ?? 0} created, ${data.deduplicated ?? 0} deduped, ${data.failed ?? 0} failed of ${data.requested ?? 0}.`
        );
        if (!dryRun) router.refresh();
      }
    } catch {
      setMessage("Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="ev-actions">
        <button type="button" disabled={busy !== null} onClick={() => run(true)}>
          {busy === "dry" ? "Running…" : "Dry-run"}
        </button>
        {allowRefresh && (
          <button type="button" disabled={busy !== null} onClick={() => run(false)}>
            {busy === "refresh" ? "Refreshing…" : "Refresh now"}
          </button>
        )}
      </div>
      {message && (
        <p className="ev-result" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
