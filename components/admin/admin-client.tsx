"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AccessTab } from "@/components/admin/access-tab";
import { useStepUp } from "@/hooks/use-step-up";
import {
  Search,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Ban,
  RotateCcw,
  ScrollText,
  BarChart2,
  LifeBuoy,
  MessageCircle,
  Send,
  Filter,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers:      number;
  verifiedUsers:   number;
  unverifiedUsers: number;
  signups24h:      number;
  signups7d:       number;
  signups30d:      number;
  suspendedUsers:  number;
}

interface AdminUser {
  id:              string;
  email:           string | null;
  name:            string | null;
  role:            string;
  verified:        boolean;
  createdAt:       string;
  suspendedAt:     string | null;
  suspendedReason: string | null;
  _count: { accounts: number; sessions: number };
}

interface AuditEntry {
  id:        string;
  action:    string;
  metadata:  Record<string, unknown> | null;
  createdAt: string;
  admin:     { id: string; name: string | null };
  target:    { id: string; name: string | null } | null;
}

type Tab = "overview" | "users" | "tickets" | "access" | "audit";

// ─── Overview stats ────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: AdminStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="h-[96px] animate-pulse rounded-[14px]"
            style={{ background: "var(--panel-2)" }}
          />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: "Total users",   value: stats.totalUsers,      icon: Users,     color: "var(--text-soft)" },
    { label: "Verified",      value: stats.verifiedUsers,   icon: UserCheck, color: "var(--success)"   },
    { label: "Unverified",    value: stats.unverifiedUsers, icon: UserX,     color: "#f59e0b"          },
    { label: "Suspended",     value: stats.suspendedUsers,  icon: Ban,       color: "var(--danger)"    },
    { label: "Signups (24h)", value: stats.signups24h,      icon: Clock,     color: "#60a5fa"          },
    { label: "Signups (7d)",  value: stats.signups7d,       icon: Clock,     color: "#818cf8"          },
    { label: "Signups (30d)", value: stats.signups30d,      icon: Clock,     color: "#a78bfa"          },
  ];

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-[14px] p-[16px]"
            style={{
              background: "var(--panel)",
              border:     "1px solid var(--border)",
              boxShadow:  "0 1px 4px rgba(0,0,0,0.25)",
            }}
          >
            <div className="flex items-center justify-between mb-[10px]">
              <Icon className="size-[15px]" style={{ color }} />
            </div>
            <p
              className="text-[28px] font-bold leading-none tabular-nums"
              style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
            >
              {value.toLocaleString()}
            </p>
            <p className="mt-[5px] text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── User row / expanded card ──────────────────────────────────────────────────

function UserRow({
  user,
  onUpdate,
}: {
  user:     AdminUser;
  onUpdate: (updated: Partial<AdminUser>) => void;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [actionLoading,  setActionLoading]  = useState<string | null>(null);
  const [actionError,    setActionError]    = useState<string | null>(null);
  const [actionSuccess,  setActionSuccess]  = useState<string | null>(null);
  const [suspendReason,  setSuspendReason]  = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  // Step-up verification — required for suspend and verify
  const { withStepUp, handleStepUpRequired, isVerified, secondsLeft, StepUpGate } = useStepUp();

  const doAction = useCallback(
    async (
      endpoint: string,
      body:     Record<string, unknown>,
      key:      string
    ) => {
      setActionLoading(key);
      setActionError(null);
      setActionSuccess(null);
      try {
        const res = await fetch(`/api/admin/users/${user.id}/${endpoint}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        });
        let data: Record<string, unknown> = {};
        try { data = await res.json() as typeof data; } catch { /* non-JSON body */ }
        if (!res.ok) {
          if (data.error === "step_up_required") {
            // Session expired mid-session — clear cache and re-open modal
            handleStepUpRequired(() => void doAction(endpoint, body, key));
            return;
          }
          setActionError(
            typeof data.error === "string" ? data.error : `Server error (${res.status})`
          );
        } else {
          setActionSuccess(key);
          onUpdate(data as Partial<AdminUser>);
          setTimeout(() => setActionSuccess(null), 2500);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setActionLoading(null);
      }
    },
    [user.id, onUpdate, handleStepUpRequired]
  );

  const isSuspended = !!user.suspendedAt;

  const roleColor =
    user.role === "OWNER"     ? "#a78bfa" :
    user.role === "ADMIN"     ? "#60a5fa" :
    user.role === "MODERATOR" ? "#34d399" :
    "var(--muted)";

  return (
    <div
      className="overflow-hidden transition-all duration-[140ms]"
      style={{
        background:   "var(--panel-2)",
        border:       "1px solid var(--border)",
        borderRadius: 12,
        opacity:      isSuspended ? 0.75 : 1,
      }}
    >
      {/* Row header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-[12px] px-[14px] py-[12px] text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
      >
        {/* Avatar placeholder */}
        <div
          className="flex size-[36px] flex-shrink-0 items-center justify-center rounded-[10px] font-mono text-[11px] font-bold text-white"
          style={{ background: `${roleColor}22`, border: `1px solid ${roleColor}38` }}
        >
          {(user.name ?? "?").slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[7px] flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--text)] truncate">
              {user.name || "(no name)"}
            </span>
            {user.verified && (
              <span
                className="flex items-center gap-[3px] rounded-full px-[5px] py-[1px] text-[9px] font-semibold uppercase"
                style={{
                  background: "rgba(34,197,94,0.10)",
                  border:     "1px solid rgba(34,197,94,0.22)",
                  color:      "var(--success)",
                }}
              >
                <ShieldCheck className="size-[8px]" /> verified
              </span>
            )}
            {isSuspended && (
              <span
                className="flex items-center gap-[3px] rounded-full px-[5px] py-[1px] text-[9px] font-semibold uppercase"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  border:     "1px solid rgba(239,68,68,0.22)",
                  color:      "var(--danger)",
                }}
              >
                <Ban className="size-[8px]" /> suspended
              </span>
            )}
          </div>
          <p className="mt-[1px] truncate text-[10px] text-[var(--muted)]">
            {user.email ?? "no email"}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-[8px]">
          <span
            className="rounded-[6px] px-[6px] py-[2px] text-[9px] font-bold uppercase tracking-wide"
            style={{
              background: `${roleColor}18`,
              color:      roleColor,
              border:     `1px solid ${roleColor}30`,
            }}
          >
            {user.role}
          </span>
          {expanded
            ? <ChevronUp  className="size-[13px] text-[var(--muted)]" />
            : <ChevronDown className="size-[13px] text-[var(--muted)]" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="flex flex-col gap-[16px] px-[14px] pb-[16px] pt-[2px]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {/* Detail grid */}
              <div className="mt-[12px] grid grid-cols-2 gap-[8px] md:grid-cols-3 lg:grid-cols-4">
                {[
                  { label: "ID",          value: user.id,                      mono: true  },
                  { label: "Email",       value: user.email ?? "—",            mono: false },
                  { label: "Joined",      value: relativeTime(user.createdAt), mono: false },
                  { label: "Sessions",    value: String(user._count.sessions),  mono: true  },
                  { label: "OAuth accts", value: String(user._count.accounts),  mono: true  },
                  ...(user.suspendedAt
                    ? [{ label: "Suspended", value: relativeTime(user.suspendedAt), mono: false }]
                    : []),
                  ...(user.suspendedReason
                    ? [{ label: "Reason", value: user.suspendedReason, mono: false }]
                    : []),
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                      {label}
                    </p>
                    <p
                      className={cn(
                        "mt-[2px] truncate text-[11px] text-[var(--text-soft)]",
                        mono && "font-mono"
                      )}
                      title={value}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Action feedback */}
              {actionError && (
                <div className="flex items-center gap-[7px] rounded-[9px] px-[10px] py-[8px] text-[12px]"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--danger)" }}>
                  <XCircle className="size-[13px] flex-shrink-0" />
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="flex items-center gap-[7px] rounded-[9px] px-[10px] py-[8px] text-[12px]"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "var(--success)" }}>
                  <CheckCircle2 className="size-[13px] flex-shrink-0" />
                  Action completed successfully.
                </div>
              )}

              {/* Actions */}
              <div
                className="flex flex-col gap-[12px] rounded-[11px] p-[12px]"
                style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Actions
                </p>

                {/* Step-up status badge */}
                {isVerified && (
                  <div className="flex items-center gap-[5px] rounded-[7px] px-[8px] py-[4px] w-fit"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}>
                    <span className="size-[5px] rounded-full bg-[var(--success)]" />
                    <p className="text-[10px] font-medium text-[var(--success)]">
                      Verified · {Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s left
                    </p>
                  </div>
                )}

              {/* Verify / Suspend row */}
                <div className="flex flex-wrap gap-[6px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => withStepUp(() => doAction("verify", { verified: !user.verified }, "verify"))}
                    disabled={actionLoading === "verify"}
                    className="gap-[6px]"
                  >
                    {user.verified ? (
                      <><UserX className="size-[11px]" />{actionLoading === "verify" ? "…" : "Unverify"}</>
                    ) : (
                      <><UserCheck className="size-[11px]" />{actionLoading === "verify" ? "…" : "Verify"}</>
                    )}
                  </Button>

                  {!isSuspended ? (
                    <>
                      {confirmSuspend ? (
                        <>
                          <Input
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="h-[32px] w-[180px] text-[12px]"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              withStepUp(() => {
                                void doAction("status", { suspended: true, reason: suspendReason }, "suspend");
                              });
                              setConfirmSuspend(false);
                            }}
                            disabled={actionLoading === "suspend"}
                            className="gap-[6px] border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.08)]"
                          >
                            <Ban className="size-[11px]" />
                            {actionLoading === "suspend" ? "…" : "Confirm suspend"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmSuspend(false)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmSuspend(true)}
                          className="gap-[6px] text-[var(--danger)]"
                        >
                          <Ban className="size-[11px]" />
                          Suspend
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => withStepUp(() => doAction("status", { suspended: false }, "unsuspend"))}
                      disabled={actionLoading === "unsuspend"}
                      className="gap-[6px]"
                    >
                      <RotateCcw className="size-[11px]" />
                      {actionLoading === "unsuspend" ? "…" : "Unsuspend"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step-up modal — portal-rendered, null when inactive */}
      {StepUpGate}
    </div>
  );
}

// ─── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AdminUser[] | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q.trim())}`);
      let data: { users?: AdminUser[]; error?: string } = {};
      try { data = await res.json() as typeof data; } catch { /* non-JSON body */ }
      if (!res.ok) {
        setError(data.error ?? `Server error (${res.status})`);
        setResults(null);
      } else {
        setResults(data.users ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUserUpdate = useCallback(
    (userId: string, updated: Partial<AdminUser>) => {
      setResults((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)) : prev
      );
    },
    []
  );

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="flex gap-[8px]"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, or user ID…"
          leftIcon={<Search className="size-[13px]" />}
          wrapperClassName="flex-1"
          className="h-[40px]"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={loading || query.trim().length < 2}
          className="flex-shrink-0"
        >
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] text-[12px]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border:     "1px solid rgba(239,68,68,0.18)",
            color:      "var(--danger)",
          }}
        >
          <AlertTriangle className="size-[13px] flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="flex flex-col gap-[6px]">
          {results.length === 0 ? (
            <div
              className="flex flex-col items-center gap-[10px] rounded-[14px] py-[40px] text-center"
              style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex size-[40px] items-center justify-center rounded-full"
                style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
              >
                <Search className="size-[16px] text-[var(--muted)]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--text-soft)]">No results</p>
                <p className="mt-[2px] text-[11px] text-[var(--muted)]">
                  Try a different name, email, or ID.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-medium text-[var(--muted)]">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onUpdate={(updated) => handleUserUpdate(user.id, updated)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Idle state */}
      {results === null && !error && !loading && (
        <div
          className="flex flex-col items-center gap-[10px] rounded-[14px] py-[48px] text-center"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <div
            className="flex size-[44px] items-center justify-center rounded-full"
            style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
          >
            <Users className="size-[18px] text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-soft)]">User lookup</p>
            <p className="mt-[2px] text-[11px] text-[var(--muted)]">
              Search by name, email address, or user ID.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit log tab ─────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  "verify.grant":      { label: "Verified",                color: "var(--success)" },
  "verify.revoke":     { label: "Unverified",              color: "#f59e0b" },
  "suspend":           { label: "Suspended",               color: "var(--danger)"  },
  "unsuspend":         { label: "Unsuspended",             color: "var(--success)" },
};

function AuditTab() {
  const [entries,  setEntries]  = useState<AuditEntry[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/audit-log");
      let data: { entries?: AuditEntry[]; error?: string } = {};
      try { data = await res.json() as typeof data; } catch { /* non-JSON body */ }
      if (!res.ok) {
        setError(data.error ?? `Server error (${res.status})`);
      } else {
        setEntries(data.entries ?? []);
        setFetched(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [fetched]);

  // Lazy-load on first render of this tab
  useEffect(() => { void load(); }, [load]);

  if (loading && !fetched) {
    return (
      <div className="flex flex-col gap-[6px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[56px] animate-pulse rounded-[10px]"
            style={{ background: "var(--panel-2)" }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] text-[12px]"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--danger)" }}
      >
        <AlertTriangle className="size-[13px]" />{error}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-[10px] rounded-[14px] py-[48px] text-center"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex size-[44px] items-center justify-center rounded-full"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
        >
          <ScrollText className="size-[18px] text-[var(--muted)]" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-[var(--text-soft)]">No audit entries</p>
          <p className="mt-[2px] text-[11px] text-[var(--muted)]">
            Admin actions will appear here once they&rsquo;ve been taken.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[4px]">
      {entries.map((entry) => {
        const info = ACTION_LABEL[entry.action] ?? { label: entry.action, color: "var(--muted)" };
        return (
          <div
            key={entry.id}
            className="flex items-start gap-[12px] rounded-[10px] px-[12px] py-[10px] transition-colors hover:bg-[rgba(255,255,255,0.025)]"
            style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
          >
            <span
              className="mt-[2px] flex size-[7px] flex-shrink-0 rounded-full"
              style={{ background: info.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-[7px] flex-wrap">
                <span className="text-[12px] font-medium" style={{ color: info.color }}>
                  {info.label}
                </span>
                {entry.target && (
                  <span className="text-[11px] text-[var(--text-soft)]">
                    →&nbsp;
                    {entry.target.name ?? entry.target.id.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className="mt-[1px] text-[10px] text-[var(--muted)]">
                by {entry.admin.name ?? entry.admin.id.slice(0, 8)}
                &nbsp;·&nbsp;
                {relativeTime(entry.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Admin Tickets tab ────────────────────────────────────────────────────────

interface AdminTicket {
  id:         string;
  category:   string;
  status:     string;
  priority:   string;
  subject:    string;
  createdAt:  string;
  updatedAt:  string;
  resolvedAt: string | null;
  user:       { id: string; name: string | null; email: string | null };
  messages:   { id: string; body: string; isAdmin: boolean; senderId: string; createdAt: string }[];
  _count:     { messages: number };
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  open:          "var(--accent-text)",
  under_review:  "#f59e0b",
  awaiting_user: "#a78bfa",
  resolved:      "var(--success)",
  dismissed:     "var(--muted)",
};
const TICKET_PRIORITY_COLORS: Record<string, string> = {
  low:    "var(--muted)",
  medium: "#60a5fa",
  high:   "#f59e0b",
  urgent: "var(--danger)",
};

function AdminTicketDetail({ ticket, onBack, onUpdated }: {
  ticket:    AdminTicket;
  onBack:    () => void;
  onUpdated: (t: AdminTicket) => void;
}) {
  const [full, setFull]         = useState<AdminTicket | null>(null);
  const [reply, setReply]       = useState("");
  const [setStatus, setSetStatus] = useState<string>("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tickets/${ticket.id}`)
      .then((r) => r.json())
      .then((j: { ticket?: AdminTicket }) => { if (j.ticket) setFull(j.ticket); })
      .catch(() => {});
  }, [ticket.id]);

  const t = full ?? ticket;
  const isClosed = ["resolved","dismissed"].includes(t.status);

  const sendReply = useCallback(async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim(), setStatus: setStatus || undefined }),
      });
      const json = await res.json() as { message?: { id: string; body: string; isAdmin: boolean; senderId: string; createdAt: string }; error?: string };
      if (!res.ok) { setError(json.error ?? "Failed to send."); return; }
      const msg = json.message;
      if (msg) {
        const newStatus = setStatus || "awaiting_user";
        const updated = { ...t, status: newStatus, updatedAt: new Date().toISOString(), messages: [...t.messages, msg] };
        setFull(updated);
        onUpdated(updated);
        setReply("");
        setSetStatus("");
      }
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }, [onUpdated, reply, setStatus, t, ticket.id]);

  const updateStatus = useCallback(async (newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json() as { ticket?: AdminTicket };
      if (res.ok && json.ticket) {
        const updated = { ...t, status: newStatus, updatedAt: new Date().toISOString() };
        setFull(updated);
        onUpdated(updated);
      }
    } catch { /* ignore */ }
  }, [onUpdated, t, ticket.id]);

  return (
    <div className="flex flex-col gap-[14px]">
      <button type="button" onClick={onBack}
        className="flex items-center gap-[6px] text-[11px] text-[var(--muted)] hover:text-[var(--text)] transition-colors w-fit">
        <ChevronDown className="size-3.5 rotate-90" /> Back to queue
      </button>

      {/* Header */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--panel)] p-[14px]">
        <div className="flex items-start justify-between gap-[8px] flex-wrap">
          <div>
            <p className="text-[14px] font-semibold text-[var(--text)]">{t.subject}</p>
            <p className="text-[10px] text-[var(--muted)] mt-[2px]">
              #{t.id.slice(-8).toUpperCase()} · {t.category} ·
              by {t.user.name ?? t.user.email ?? t.user.id.slice(0,8)} ·
              {relativeTime(t.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className="rounded-full px-[7px] py-[2px] text-[10px] font-bold"
              style={{ color: TICKET_STATUS_COLORS[t.status], background: `${TICKET_STATUS_COLORS[t.status]}18`, border: `1px solid ${TICKET_STATUS_COLORS[t.status]}28` }}>
              {t.status.replace("_"," ")}
            </span>
            <span className="rounded-full px-[7px] py-[2px] text-[10px] font-bold"
              style={{ color: TICKET_PRIORITY_COLORS[t.priority], background: `${TICKET_PRIORITY_COLORS[t.priority]}18`, border: `1px solid ${TICKET_PRIORITY_COLORS[t.priority]}28` }}>
              {t.priority}
            </span>
          </div>
        </div>
        {/* Quick status actions */}
        <div className="flex gap-[5px] mt-[10px] flex-wrap">
          {["open","under_review","awaiting_user","resolved","dismissed"].map((s) => (
            <button key={s} type="button" disabled={t.status === s} onClick={() => void updateStatus(s)}
              className={cn("px-[8px] py-[3px] rounded-[6px] text-[10px] font-medium transition-colors",
                t.status === s
                  ? "opacity-50 cursor-default"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]")}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-[6px]">
        {t.messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[80%] rounded-[11px] px-[12px] py-[9px]",
              msg.isAdmin
                ? "bg-[rgba(109,40,217,0.10)] border border-[rgba(109,40,217,0.22)]"
                : "bg-[var(--panel)] border border-[var(--border)]")}>
              <p className="text-[10px] font-semibold mb-[3px]" style={{ color: msg.isAdmin ? "var(--accent-text)" : "var(--muted)" }}>
                {msg.isAdmin ? "Admin" : (t.user.name ?? "User")}
              </p>
              <p className="text-[12px] text-[var(--text-soft)] whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              <p className="text-[10px] text-[var(--muted)] mt-[3px]">{relativeTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      {!isClosed && (
        <div className="flex flex-col gap-[8px] rounded-[12px] border border-[var(--border)] bg-[var(--panel)] p-[12px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">Reply</p>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
            placeholder="Write a reply to the user…"
            className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--panel-2)] px-[10px] py-[8px] text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <div className="flex items-center gap-[8px] flex-wrap">
            <select value={setStatus} onChange={(e) => setSetStatus(e.target.value)}
              className="rounded-[7px] border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[5px] text-[11px] text-[var(--text)] focus:outline-none">
              <option value="">Status: awaiting reply (default)</option>
              <option value="open">Set status: open</option>
              <option value="under_review">Set status: under review</option>
              <option value="resolved">Set status: resolved</option>
              <option value="dismissed">Set status: dismissed</option>
            </select>
            <Button variant="primary" size="sm" disabled={!reply.trim() || sending}
              onClick={() => void sendReply()}>
              <Send className="size-[11px]" />
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
          {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function TicketsTab() {
  const [tickets, setTickets]     = useState<AdminTicket[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fetched, setFetched]     = useState(false);
  const [selected, setSelected]   = useState<AdminTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const load = useCallback(async (force = false) => {
    if (fetched && !force) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter)   params.set("status",   statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res  = await fetch(`/api/admin/tickets?${params.toString()}`);
      const json = await res.json() as { tickets?: AdminTicket[] };
      setTickets(json.tickets ?? []);
      setFetched(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [fetched, statusFilter, priorityFilter]);

  useEffect(() => { void load(); }, [load]);

  if (selected) {
    return (
      <AdminTicketDetail
        ticket={selected}
        onBack={() => setSelected(null)}
        onUpdated={(t) => {
          setSelected(t);
          setTickets((prev) => prev.map((x) => x.id === t.id ? t : x));
        }}
      />
    );
  }

  const openCount     = tickets.filter((t) => t.status === "open").length;
  const reviewCount   = tickets.filter((t) => t.status === "under_review").length;
  const awaitingCount = tickets.filter((t) => t.status === "awaiting_user").length;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Stats strip */}
      {fetched && (
        <div className="grid grid-cols-3 gap-[8px]">
          {[
            { label: "Open",          value: openCount,     color: "var(--accent-text)" },
            { label: "Under review",  value: reviewCount,   color: "#f59e0b"            },
            { label: "Awaiting user", value: awaitingCount, color: "#a78bfa"            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-[11px] border border-[var(--border)] bg-[var(--panel)] p-[12px] text-center">
              <p className="text-[22px] font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--muted)] mt-[2px]">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-[8px] flex-wrap">
        <Filter className="size-[12px] text-[var(--muted)] flex-shrink-0" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setFetched(false); }}
          className="rounded-[7px] border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[5px] text-[11px] text-[var(--text)] focus:outline-none">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="awaiting_user">Awaiting user</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setFetched(false); }}
          className="rounded-[7px] border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[5px] text-[11px] text-[var(--text)] focus:outline-none">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="button" onClick={() => { setFetched(false); }}
          className="flex items-center gap-[5px] text-[11px] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Ticket list */}
      {loading && !fetched ? (
        <div className="flex flex-col gap-[5px]">
          {[0,1,2,3].map((i) => <div key={i} className="h-[56px] animate-pulse rounded-[10px]" style={{ background: "var(--panel-2)" }} />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-[10px] rounded-[14px] py-[48px] text-center"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <LifeBuoy className="size-[22px] text-[var(--muted)]" />
          <p className="text-[13px] font-medium text-[var(--text-soft)]">No tickets</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[4px]">
          {tickets.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t)}
              className="flex items-center gap-[12px] rounded-[10px] border border-[var(--border)] bg-[var(--panel)] px-[12px] py-[10px] text-left hover:border-[var(--border-strong)] transition-colors w-full">
              <MessageCircle className="size-[14px] flex-shrink-0 text-[var(--muted)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-[6px] flex-wrap">
                  <p className="text-[12px] font-semibold text-[var(--text)] truncate">{t.subject}</p>
                  <span className="text-[10px] font-bold rounded-full px-[6px] py-[1px]"
                    style={{ color: TICKET_STATUS_COLORS[t.status], background: `${TICKET_STATUS_COLORS[t.status]}18` }}>
                    {t.status.replace("_"," ")}
                  </span>
                  <span className="text-[10px] font-bold rounded-full px-[6px] py-[1px]"
                    style={{ color: TICKET_PRIORITY_COLORS[t.priority], background: `${TICKET_PRIORITY_COLORS[t.priority]}18` }}>
                    {t.priority}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--muted)] mt-[1px]">
                  {t.user.name ?? "?"} · {t.category} · {relativeTime(t.updatedAt)} · {t._count.messages} msg{t._count.messages !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronDown className="size-[12px] text-[var(--muted)] -rotate-90 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root client component ─────────────────────────────────────────────────────

export function AdminClient({
  initialStats,
  userRole,
}: {
  initialStats: AdminStats | null;
  userRole: "ADMIN" | "OWNER";
}) {
  const isOwner = userRole === "OWNER";
  const [tab, setTab] = useState<Tab>("overview");
  const [stats]       = useState<AdminStats | null>(initialStats);

  // "access" tab calls requireOwnerApi — only show to OWNER.
  const ALL_TABS: { key: Tab; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
    { key: "overview",  label: "Overview",  icon: BarChart2              },
    { key: "users",     label: "Users",     icon: Users                  },
    { key: "tickets",   label: "Tickets",   icon: LifeBuoy               },
    { key: "access",    label: "Access",    icon: ShieldCheck, ownerOnly: true },
    { key: "audit",     label: "Audit log", icon: ScrollText             },
  ];
  const TABS = ALL_TABS.filter((t) => !t.ownerOnly || isOwner);

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
          <div
            className="flex size-[38px] flex-shrink-0 items-center justify-center rounded-[12px]"
            style={{
              background: "rgba(109,40,217,0.12)",
              border:     "1px solid rgba(109,40,217,0.28)",
            }}
          >
            <ShieldCheck className="size-[17px]" style={{ color: "var(--accent-text)" }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold leading-none text-[var(--text)]" style={{ letterSpacing: "-0.025em" }}>
              Admin
            </h1>
            <p className="mt-[2px] text-[11px] text-[var(--muted)]">
              {isOwner ? "Owner control center" : "Admin control center"}
            </p>
          </div>
        </div>
        <Badge variant="accent" size="sm">
          {userRole}
        </Badge>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-[2px] rounded-[12px] p-[3px]"
        style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
        role="tablist"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-[7px] rounded-[9px] py-[7px] px-[12px]",
              "text-[12px] font-medium transition-all duration-[140ms]",
              tab === key
                ? "bg-[rgba(109,40,217,0.80)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.40)]"
                : "text-[var(--muted)] hover:text-[var(--text-soft)] hover:bg-[rgba(255,255,255,0.04)]"
            )}
          >
            <Icon className="size-[12px]" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "overview"  && <OverviewTab stats={stats} />}
        {tab === "users"     && <UsersTab />}
        {tab === "tickets"   && <TicketsTab />}
        {tab === "access"    && isOwner && <AccessTab />}
        {tab === "audit"     && <AuditTab />}
      </div>
    </div>
  );
}
