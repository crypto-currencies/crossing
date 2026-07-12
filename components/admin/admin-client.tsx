"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AccessTab } from "@/components/admin/access-tab";
import { SubmissionsTab } from "@/components/admin/submissions-tab";
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
  Inbox,
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

type Tab = "overview" | "submissions" | "users" | "access" | "audit";

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
    [user.id, onUpdate]
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

              {/* Verify / Suspend row */}
                <div className="flex flex-wrap gap-[6px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => doAction("verify", { verified: !user.verified }, "verify")}
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
                              void doAction("status", { suspended: true, reason: suspendReason }, "suspend");
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
                      onClick={() => doAction("status", { suspended: false }, "unsuspend")}
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

  // Lazy-load on first render of this tab. Deferred to a microtask so the
  // fetch kickoff (and its synchronous setLoading/setError calls) run in a
  // separate task from the effect's own invocation.
  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

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
    { key: "overview",     label: "Overview",     icon: BarChart2 },
    { key: "submissions",  label: "Submissions",  icon: Inbox     },
    { key: "users",        label: "Users",        icon: Users     },
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
        {tab === "overview"     && <OverviewTab stats={stats} />}
        {tab === "submissions"  && <SubmissionsTab />}
        {tab === "users"        && <UsersTab />}
        {tab === "access"    && isOwner && <AccessTab />}
        {tab === "audit"     && <AuditTab />}
      </div>
    </div>
  );
}
