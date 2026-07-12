"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Pencil,
  Copy,
  Inbox,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AdminSubmission } from "@/types";

type SubTab = "PENDING" | "APPROVED" | "REJECTED";

const SUB_TABS: { key: SubTab; label: string; icon: typeof Clock }[] = [
  { key: "PENDING", label: "Pending", icon: Clock },
  { key: "APPROVED", label: "Approved", icon: CheckCircle2 },
  { key: "REJECTED", label: "Rejected", icon: XCircle },
];

interface Overrides {
  name: string;
  websiteUrl: string;
  tagline: string;
  description: string;
}

function toOverrides(s: AdminSubmission): Overrides {
  return { name: s.name, websiteUrl: s.websiteUrl, tagline: s.tagline, description: s.description };
}

/** Only send fields that actually changed from the original. */
function diffOverrides(original: AdminSubmission, edited: Overrides): Partial<Overrides> {
  const diff: Partial<Overrides> = {};
  if (edited.name !== original.name) diff.name = edited.name;
  if (edited.websiteUrl !== original.websiteUrl) diff.websiteUrl = edited.websiteUrl;
  if (edited.tagline !== original.tagline) diff.tagline = edited.tagline;
  if (edited.description !== original.description) diff.description = edited.description;
  return diff;
}

export function SubmissionsTab() {
  const [subTab, setSubTab] = useState<SubTab>("PENDING");
  const [items, setItems] = useState<AdminSubmission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: SubTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions?status=${status}&pageSize=50`);
      let data: { items?: AdminSubmission[]; error?: string } = {};
      try { data = (await res.json()) as typeof data; } catch { /* non-JSON body */ }
      if (!res.ok) {
        setError(data.error ?? `Server error (${res.status})`);
        setItems(null);
      } else {
        setItems(data.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Deferred to a microtask so the fetch kickoff (and its synchronous
  // setLoading/setError calls) run in a separate task from the effect's own
  // invocation — matches the pattern in admin-client.tsx's AuditTab.
  useEffect(() => {
    queueMicrotask(() => { void load(subTab); });
  }, [subTab, load]);

  // Duplicate detection — flag pending submissions that share a websiteUrl
  // with another submission currently in the same fetched batch.
  const duplicateIds = useMemo(() => {
    if (!items) return new Set<string>();
    const byUrl = new Map<string, number>();
    for (const s of items) byUrl.set(s.websiteUrl, (byUrl.get(s.websiteUrl) ?? 0) + 1);
    return new Set(items.filter((s) => (byUrl.get(s.websiteUrl) ?? 0) > 1).map((s) => s.id));
  }, [items]);

  function handleReviewed(id: string) {
    setItems((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div
        className="flex gap-[2px] rounded-[12px] p-[3px]"
        style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
        role="tablist"
        aria-label="Submission status"
      >
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={subTab === key}
            onClick={() => setSubTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-[7px] rounded-[9px] py-[7px] px-[12px]",
              "text-[12px] font-medium transition-all duration-[140ms]",
              subTab === key
                ? "bg-[rgba(109,40,217,0.80)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.40)]"
                : "text-[var(--muted)] hover:text-[var(--text-soft)] hover:bg-[rgba(255,255,255,0.04)]"
            )}
          >
            <Icon className="size-[12px]" />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col gap-[6px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-[12px]" style={{ background: "var(--panel-2)" }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div
          className="flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] text-[12px]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--danger)" }}
        >
          <AlertTriangle className="size-[13px] flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && items && items.length === 0 && (
        <div
          className="flex flex-col items-center gap-[10px] rounded-[14px] py-[48px] text-center"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div className="flex size-[44px] items-center justify-center rounded-full" style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}>
            <Inbox className="size-[18px] text-[var(--muted)]" />
          </div>
          <p className="text-[13px] font-medium text-[var(--text-soft)]">
            {subTab === "PENDING" ? "The queue is empty" : "Nothing here yet"}
          </p>
        </div>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          {items.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              likelyDuplicate={duplicateIds.has(s.id)}
              onReviewed={() => handleReviewed(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  submission,
  likelyDuplicate,
  onReviewed,
}: {
  submission: AdminSubmission;
  likelyDuplicate: boolean;
  onReviewed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Overrides>(toOverrides(submission));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPending = submission.status === "PENDING";

  async function approve() {
    setBusy("approve");
    setActionError(null);
    try {
      const overrides = diffOverrides(submission, edited);
      const res = await fetch(`/api/admin/submissions/${submission.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? `Server error (${res.status})`);
      } else {
        onReviewed();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submission.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderatorNote: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? `Server error (${res.status})`);
      } else {
        onReviewed();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="flex flex-col gap-[12px] rounded-[12px] p-[16px]"
      style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[13.5px] font-semibold text-[var(--text)]">{submission.name}</span>
            <Badge variant="default" size="xs">{submission.category.name}</Badge>
            {likelyDuplicate && (
              <span className="flex items-center gap-[4px] rounded-full border border-[rgba(245,158,11,0.30)] bg-[rgba(245,158,11,0.10)] px-[7px] py-[2px] text-[9.5px] font-semibold uppercase text-[#f59e0b]">
                <Copy className="size-[9px]" />
                Possible duplicate
              </span>
            )}
          </div>
          <p className="mt-[3px] text-[12px] text-[var(--text-soft)]">{submission.tagline}</p>
        </div>
        <a
          href={submission.websiteUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex flex-shrink-0 items-center gap-[4px] text-[11.5px] font-medium text-[var(--accent-text)] hover:underline"
        >
          {new URL(submission.websiteUrl).hostname}
          <ExternalLink className="size-[10px]" />
        </a>
      </div>

      <p className="text-[12px] leading-[1.6] text-[var(--muted)]">{submission.description}</p>

      <div className="flex flex-wrap items-center gap-[10px] text-[10.5px] text-[var(--muted)]">
        <span>Submitted by {submission.submittedBy.name ?? submission.submittedBy.email ?? "unknown"}</span>
        <span aria-hidden>·</span>
        <span>{relativeTime(submission.createdAt)}</span>
      </div>

      {!isPending && (
        <div
          className="flex items-center gap-[6px] rounded-[9px] px-[10px] py-[8px] text-[11.5px]"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          {submission.status === "APPROVED" ? (
            <CheckCircle2 className="size-[12px] text-[var(--success)]" />
          ) : (
            <XCircle className="size-[12px] text-[var(--danger)]" />
          )}
          <span className="text-[var(--text-soft)]">
            {submission.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
            {submission.reviewedBy?.name ?? "a moderator"}
            {submission.reviewedAt ? ` · ${relativeTime(submission.reviewedAt)}` : ""}
          </span>
          {submission.moderatorNote && (
            <span className="text-[var(--muted)]">— {submission.moderatorNote}</span>
          )}
        </div>
      )}

      {isPending && editing && (
        <div className="flex flex-col gap-[8px] rounded-[9px] p-[10px]" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <Input label="Name" value={edited.name} onChange={(e) => setEdited((v) => ({ ...v, name: e.target.value }))} className="h-[32px] text-[12px]" />
          <Input label="Website URL" value={edited.websiteUrl} onChange={(e) => setEdited((v) => ({ ...v, websiteUrl: e.target.value }))} className="h-[32px] text-[12px]" />
          <Input label="Tagline" value={edited.tagline} onChange={(e) => setEdited((v) => ({ ...v, tagline: e.target.value }))} className="h-[32px] text-[12px]" />
          <Textarea label="Description" value={edited.description} onChange={(e) => setEdited((v) => ({ ...v, description: e.target.value }))} rows={3} className="text-[12px]" />
        </div>
      )}

      {isPending && rejecting && (
        <Textarea
          label="Moderator note (sent to the submitter)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why isn't this being approved?"
          rows={2}
          className="text-[12px]"
        />
      )}

      {actionError && (
        <div className="flex items-center gap-[7px] rounded-[9px] px-[10px] py-[8px] text-[12px]" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--danger)" }}>
          <XCircle className="size-[13px] flex-shrink-0" />
          {actionError}
        </div>
      )}

      {isPending && (
        <div className="flex flex-wrap gap-[6px]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setEditing((v) => !v); setEdited(toOverrides(submission)); }}
            className="gap-[6px]"
          >
            <Pencil className="size-[11px]" />
            {editing ? "Cancel edit" : "Edit before approving"}
          </Button>
          {rejecting ? (
            <>
              <Button size="sm" variant="secondary" onClick={reject} disabled={busy === "reject"} className="gap-[6px] border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.08)]">
                {busy === "reject" ? "…" : "Confirm reject"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} className="gap-[6px] text-[var(--danger)]">
              <XCircle className="size-[11px]" />
              Reject
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={approve} disabled={busy === "approve"} className="gap-[6px]">
            <CheckCircle2 className="size-[11px]" />
            {busy === "approve" ? "…" : "Approve"}
          </Button>
        </div>
      )}
    </div>
  );
}
