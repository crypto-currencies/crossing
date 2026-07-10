"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShieldOff,
  ShieldCheck,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/surface";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportTarget {
  id:        string;
  name:      string | null;
  role:      string;
  suspended: boolean;
  avatarUrl: string | null;
}

interface ReportItem {
  id:           string;
  reason:       string;
  details:      string;
  status:       string;
  adminNote:    string | null;
  resolvedAt:   string | null;
  resolvedById: string | null;
  createdAt:    string;
  target:       ReportTarget | null;
  reporter:     { id: string; name: string | null } | null;
}

interface ModerationClientProps {
  initialReports: ReportItem[];
  initialTotal:   number;
  initialStatus:  string;
  counts: {
    pending:   number;
    resolved:  number;
    dismissed: number;
  };
}

// ─── Reason labels ────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  impersonation:   "Impersonation",
  harassment:      "Harassment / threats",
  illegal_content: "Illegal content",
  copyright:       "Copyright infringement",
  scam_phishing:   "Scam / phishing",
  sexual_content:  "Inappropriate sexual content",
  malware:         "Malware / harmful links",
  other:           "Other",
};

const REASON_COLORS: Record<string, string> = {
  illegal_content: "var(--danger)",
  sexual_content:  "var(--danger)",
  malware:         "var(--danger)",
  harassment:      "var(--warning)",
  scam_phishing:   "var(--warning)",
  impersonation:   "var(--accent-text)",
  copyright:       "var(--accent-text)",
  other:           "var(--text-soft)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger,
}: {
  label:    string;
  icon:     React.ElementType;
  onClick:  () => void;
  disabled?: boolean;
  danger?:  boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-[6px] rounded-[var(--radius-md)] border px-[10px] py-[6px] t-caption font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        danger
          ? "border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(192,72,72,0.12)]"
          : "border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
      )}
    >
      <Icon className="size-3.5 flex-shrink-0" />
      {label}
    </button>
  );
}

// ─── Single report row ────────────────────────────────────────────────────────

function ReportRow({
  report,
  onActionDone,
}: {
  report:      ReportItem;
  onActionDone: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote]         = useState("");
  const [acting, startAct]      = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const doAction = useCallback(
    (action: string, extraBody: Record<string, string> = {}) => {
      startAct(async () => {
        setFeedback(null);
        try {
          const res = await fetch(`/api/admin/reports/${report.id}`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action, note: note.trim() || undefined, ...extraBody }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            setFeedback(`Error: ${j.error ?? res.status}`);
            return;
          }
          onActionDone(report.id);
        } catch {
          setFeedback("Network error — try again.");
        }
      });
    },
    [note, onActionDone, report.id]
  );

  const t = report.target;
  const reasonColor  = REASON_COLORS[report.reason]  ?? "var(--text-soft)";
  const reasonLabel  = REASON_LABELS[report.reason]  ?? report.reason;
  const isPending    = report.status === "pending";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[12px] px-[14px] py-[12px]">
        {/* Avatar */}
        <div className="flex-shrink-0 size-8 rounded-full bg-[var(--panel-2)] overflow-hidden border border-[var(--border)]">
          {t?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center w-full h-full t-caption text-[var(--muted)]">
              {(t?.name ?? "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Target info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className="t-body-sm font-medium text-[var(--text)] truncate">
              {t ? (t.name ?? t.id) : "Unknown user"}
            </span>
            {t?.suspended && (
              <span className="t-caption px-[5px] py-[1px] rounded bg-[rgba(192,72,72,0.18)] text-[var(--danger)]">
                suspended
              </span>
            )}
          </div>
          <div className="flex items-center gap-[8px] mt-[2px]">
            <span className="t-caption font-medium" style={{ color: reasonColor }}>
              {reasonLabel}
            </span>
            <span className="t-caption text-[var(--muted)]">{fmtDate(report.createdAt)}</span>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          {report.status === "pending" && (
            <span className="flex items-center gap-[4px] t-caption text-[var(--warning)]">
              <Clock className="size-3" /> Pending
            </span>
          )}
          {report.status === "resolved" && (
            <span className="flex items-center gap-[4px] t-caption text-[var(--success)]">
              <CheckCircle2 className="size-3" /> Resolved
            </span>
          )}
          {report.status === "dismissed" && (
            <span className="flex items-center gap-[4px] t-caption text-[var(--muted)]">
              <XCircle className="size-3" /> Dismissed
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 p-[4px] rounded text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {/* ── Expanded detail panel ────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-[14px] py-[12px] flex flex-col gap-[12px]">

          {/* Reporter + detail */}
          <div className="flex flex-col gap-[4px]">
            {report.reporter && (
              <p className="t-caption text-[var(--muted)]">
                Reported by{" "}
                <span className="text-[var(--text-soft)]">
                  {report.reporter.name ?? report.reporter.id}
                </span>
              </p>
            )}
            {report.details && (
              <p className="t-body-sm text-[var(--text-soft)] leading-relaxed">
                &ldquo;{report.details}&rdquo;
              </p>
            )}
            {!report.details && (
              <p className="t-caption text-[var(--muted)] italic">No additional details provided.</p>
            )}
          </div>

          {/* Admin note (resolved reports) */}
          {report.adminNote && (
            <div className="rounded-[var(--radius-md)] bg-[var(--panel-2)] px-[10px] py-[8px]">
              <p className="t-caption text-[var(--muted)]">Admin note</p>
              <p className="t-body-sm text-[var(--text-soft)] mt-[2px]">{report.adminNote}</p>
            </div>
          )}

          {/* Actions (only for pending reports) */}
          {isPending && (
            <div className="flex flex-col gap-[10px]">
              {/* Note input */}
              <div className="flex flex-col gap-[4px]">
                <label className="t-caption text-[var(--muted)]">
                  Admin note (attached to all actions below, optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Internal note for audit log…"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-soft)] px-[10px] py-[7px] t-body-sm text-[var(--text)] placeholder:text-[var(--muted)] resize-none focus:outline-none focus:border-[var(--border-focus)]"
                />
              </div>

              {/* Account actions */}
              <div>
                <p className="t-caption text-[var(--muted)] mb-[6px]">Account</p>
                <div className="flex flex-wrap gap-[6px]">
                  {!t?.suspended ? (
                    <ActionBtn
                      label="Suspend user"
                      icon={ShieldOff}
                      danger
                      disabled={acting}
                      onClick={() => doAction("suspend", { reason: note })}
                    />
                  ) : (
                    <ActionBtn
                      label="Unsuspend user"
                      icon={ShieldCheck}
                      disabled={acting}
                      onClick={() => doAction("unsuspend")}
                    />
                  )}
                  <ActionBtn
                    label="Dismiss report"
                    icon={XCircle}
                    disabled={acting}
                    onClick={() => doAction("dismiss")}
                  />
                </div>
              </div>

              {/* Feedback */}
              {feedback && (
                <p className="t-caption text-[var(--danger)]">{feedback}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label:   string;
  count:   number;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-[6px] px-[12px] py-[7px] rounded-[var(--radius-md)] t-body-sm font-medium transition-colors",
        active
          ? "bg-[var(--panel-2)] text-[var(--text)]"
          : "text-[var(--text-soft)] hover:text-[var(--text)]"
      )}
    >
      {label}
      <span
        className={cn(
          "px-[5px] py-[1px] rounded t-caption tabular-nums",
          active ? "bg-[var(--panel-3)] text-[var(--text)]" : "text-[var(--muted)]"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ModerationClient({
  initialReports,
  initialTotal,
  initialStatus,
  counts,
}: ModerationClientProps) {
  const router = useRouter();
  const [reports, setReports]   = useState<ReportItem[]>(initialReports);
  const [status, setStatus]     = useState(initialStatus);
  const [, startRefresh]        = useTransition();

  const tabs = [
    { value: "pending",   label: "Pending",   count: counts.pending   },
    { value: "resolved",  label: "Resolved",  count: counts.resolved  },
    { value: "dismissed", label: "Dismissed", count: counts.dismissed },
    { value: "all",       label: "All",       count: counts.pending + counts.resolved + counts.dismissed },
  ];

  const switchTab = (val: string) => {
    setStatus(val);
    router.replace(`?status=${val}`, { scroll: false });
    startRefresh(() => router.refresh());
  };

  // Remove a report from the local list after action (optimistic)
  const handleActionDone = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    // Refresh server data after a short delay so counts update
    setTimeout(() => router.refresh(), 400);
  }, [router]);

  return (
    <div className="section-stack">
      <PageHeader
        title="Moderation"
        description="Review profile reports and take action on content or accounts."
      />

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[var(--card-gap)]">
        {[
          { label: "Pending review",  value: counts.pending,   color: "var(--warning)", icon: Clock         },
          { label: "Resolved",        value: counts.resolved,  color: "var(--success)", icon: CheckCircle2  },
          { label: "Dismissed",       value: counts.dismissed, color: "var(--muted)",   icon: XCircle       },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[16px]"
          >
            <Icon className="size-4 mb-[8px]" style={{ color }} />
            <p className="text-[28px] font-bold text-[var(--text)] leading-none tabular-nums">{value}</p>
            <p className="t-caption mt-[4px]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-[8px]">
        <div className="flex items-center gap-[4px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[4px]">
          {tabs.map((t) => (
            <Tab
              key={t.value}
              label={t.label}
              count={t.count}
              active={status === t.value}
              onClick={() => switchTab(t.value)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => { startRefresh(() => router.refresh()); }}
          className="flex items-center gap-[6px] t-caption text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Report list ────────────────────────────────────────────────── */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-[48px] gap-[10px] text-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--panel-2)]">
            <Inbox className="size-5 text-[var(--text-soft)]" />
          </div>
          <div>
            <p className="t-label text-[var(--text)]">No {status === "all" ? "" : status} reports</p>
            <p className="t-caption mt-[3px] max-w-[280px]">
              {status === "pending"
                ? "Queue is clear — no pending reports right now."
                : `No ${status} reports to show.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          <p className="t-caption text-[var(--muted)]">
            {reports.length} of {initialTotal} report{initialTotal !== 1 ? "s" : ""}
          </p>
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} onActionDone={handleActionDone} />
          ))}
        </div>
      )}
    </div>
  );
}
