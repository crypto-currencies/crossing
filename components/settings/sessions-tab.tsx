"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  LogOut,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { useToastStore } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = {
  id:         string;
  deviceHint: string;
  type:       "browser" | "mobile";
  maskedIp:   string | null;
  createdAt:  string;
  lastSeenAt: string;
  expires:    string;
  current:    boolean;
};

// ─── Device parsing ───────────────────────────────────────────────────────────

function parseDeviceParts(hint: string): { browser: string; os: string } {
  // deviceHint format: "Chrome on macOS", "Safari on iPhone", "Firefox on Windows", etc.
  const m = hint.match(/^(.+?)\s+on\s+(.+)$/i);
  if (m) return { browser: m[1].trim(), os: m[2].trim() };
  return { browser: hint, os: "" };
}

function DeviceIcon({
  hint,
  size = 18,
}: {
  hint: string;
  size?: number;
}) {
  const lower = hint.toLowerCase();
  if (/ipad|tablet/i.test(lower)) {
    return <Tablet size={size} className="flex-shrink-0" style={{ color: "var(--text-soft)" }} />;
  }
  if (/iphone|android|mobile|ios/i.test(lower)) {
    return <Smartphone size={size} className="flex-shrink-0" style={{ color: "var(--text-soft)" }} />;
  }
  return <Monitor size={size} className="flex-shrink-0" style={{ color: "var(--text-soft)" }} />;
}

// ─── Single revoke modal ──────────────────────────────────────────────────────

function RevokeModal({
  open,
  onClose,
  session,
  onRevoked,
}: {
  open:      boolean;
  onClose:   () => void;
  session:   Session | null;
  onRevoked: (id: string) => void;
}) {
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = useCallback(async () => {
    if (!session) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toastError("Revoke failed", data.message ?? "Could not revoke session.");
        return;
      }
      toastSuccess("Session revoked", "That device has been signed out.");
      onRevoked(session.id);
      onClose();
    } finally {
      setRevoking(false);
    }
  }, [session, toastSuccess, toastError, onRevoked, onClose]);

  const { browser, os } = session ? parseDeviceParts(session.deviceHint) : { browser: "Unknown", os: "" };

  return (
    <Modal open={open} onClose={onClose} title="Sign out session" size="sm">
      <div className="flex flex-col gap-[16px]">
        <div
          className="flex items-center gap-[12px] rounded-[var(--radius-md)] px-[14px] py-[12px]"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
        >
          {session && (
            <div
              className="flex size-[36px] flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: "var(--panel-3)", border: "1px solid var(--border)" }}
            >
              <DeviceIcon hint={session.deviceHint} size={16} />
            </div>
          )}
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{browser}</p>
            {os && <p className="t-caption" style={{ color: "var(--muted)" }}>{os}</p>}
          </div>
        </div>
        <p className="t-body-sm" style={{ color: "var(--text-soft)" }}>
          This will immediately sign out that device and invalidate its session token. It will need to sign in again.
        </p>
        <div className="flex justify-end gap-[8px]">
          <Button variant="ghost" size="md" onClick={onClose} disabled={revoking}>Cancel</Button>
          <Button variant="danger" size="md" loading={revoking} onClick={handleRevoke}>
            <LogOut className="size-3.5" />
            Sign out device
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Revoke all modal ─────────────────────────────────────────────────────────

function RevokeAllModal({
  open,
  onClose,
  count,
  onRevoked,
}: {
  open:      boolean;
  onClose:   () => void;
  count:     number;
  onRevoked: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/sessions", { method: "DELETE" });
      if (!res.ok) {
        toastError("Revoke failed", "Could not sign out other sessions.");
        return;
      }
      toastSuccess(
        "All other sessions signed out",
        `${count} other device${count !== 1 ? "s have" : " has"} been signed out.`
      );
      onRevoked();
      onClose();
    } finally {
      setRevoking(false);
    }
  }, [count, toastSuccess, toastError, onRevoked, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Sign out all other sessions" size="sm">
      <div className="flex flex-col gap-[16px]">
        <p className="t-body-sm" style={{ color: "var(--text-soft)" }}>
          All <span className="font-medium" style={{ color: "var(--text)" }}>
            {count} other device{count !== 1 ? "s" : ""}
          </span> will be immediately signed out. They will need to sign in again to access your account.
        </p>
        <div className="flex justify-end gap-[8px]">
          <Button variant="ghost" size="md" onClick={onClose} disabled={revoking}>Cancel</Button>
          <Button variant="danger" size="md" loading={revoking} onClick={handleRevoke}>
            <LogOut className="size-3.5" />
            Sign out all other sessions
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onRevokeClick,
}: {
  session:       Session;
  onRevokeClick: (s: Session) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { browser, os } = parseDeviceParts(session.deviceHint);
  const isCurrent = session.current;

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        background: isCurrent ? "rgba(139,92,246,0.06)" : "var(--panel-2)",
        border: `1px solid ${isCurrent ? "var(--accent-border)" : "var(--border)"}`,
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-[14px] px-[16px] py-[14px]">
        {/* Device icon */}
        <div
          className="flex size-[40px] flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]"
          style={{
            background: isCurrent ? "rgba(139,92,246,0.12)" : "var(--panel-3)",
            border: `1px solid ${isCurrent ? "rgba(139,92,246,0.22)" : "var(--border)"}`,
          }}
        >
          <DeviceIcon hint={session.deviceHint} size={18} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[8px]">
            <p className="text-[13px] font-semibold leading-none" style={{ color: "var(--text)" }}>
              {browser}
            </p>
            {isCurrent && (
              <span
                className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-[2.5px] text-[10px] font-semibold"
                style={{
                  background: "rgba(139,92,246,0.15)",
                  color:      "var(--accent-text)",
                  border:     "1px solid rgba(139,92,246,0.25)",
                }}
              >
                <Shield className="size-[9px]" />
                Current session
              </span>
            )}
          </div>
          <div className="mt-[5px] flex flex-wrap items-center gap-x-[12px] gap-y-[3px]">
            {os && (
              <span className="t-caption" style={{ color: "var(--text-soft)" }}>
                {os}
              </span>
            )}
            <span className="flex items-center gap-[4px] t-caption" style={{ color: "var(--muted)" }}>
              <Clock className="size-[10px]" />
              {isCurrent ? "Active now" : `Last seen ${relativeTime(session.lastSeenAt)}`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-[6px] flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex size-[28px] items-center justify-center rounded-[8px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: "var(--muted)" }}
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded
              ? <ChevronUp   className="size-[13px]" />
              : <ChevronDown className="size-[13px]" />}
          </button>
          {!isCurrent && (
            <Button
              variant="ghost"
              size="sm"
              style={{ color: "var(--text-soft)" }}
              onClick={() => onRevokeClick(session)}
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="flex flex-wrap gap-x-[24px] gap-y-[10px] border-t px-[16px] py-[14px]"
          style={{ borderColor: isCurrent ? "rgba(139,92,246,0.15)" : "var(--border-soft)" }}
        >
          {session.maskedIp && (
            <div className="flex items-center gap-[6px]">
              <Globe className="size-[11px] flex-shrink-0" style={{ color: "var(--muted)" }} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>IP</p>
                <p className="text-[12px] font-mono" style={{ color: "var(--text-soft)" }}>
                  {session.maskedIp}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Signed in
            </p>
            <p className="text-[12px]" style={{ color: "var(--text-soft)" }}>
              {new Date(session.createdAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Last active
            </p>
            <p className="text-[12px]" style={{ color: "var(--text-soft)" }}>
              {isCurrent
                ? "Now"
                : new Date(session.lastSeenAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Expires
            </p>
            <p className="text-[12px]" style={{ color: "var(--text-soft)" }}>
              {new Date(session.expires).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SessionsTab ──────────────────────────────────────────────────────────────

export function SessionsTab() {
  const { error: toastError } = useToastStore();

  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [revokeTarget,   setRevokeTarget]   = useState<Session | null>(null);
  const [showRevoke,     setShowRevoke]     = useState(false);
  const [showRevokeAll,  setShowRevokeAll]  = useState(false);

  const loadSessions = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) {
        toastError("Could not load sessions", "Please try again.");
        return;
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      toastError("Could not load sessions", "Network error.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toastError]);

  useEffect(() => {
    // Deferred to a microtask so the fetch kickoff (and its synchronous
    // setLoading/setRefreshing calls) run in a separate task from the
    // effect's own invocation.
    queueMicrotask(() => { void loadSessions(); });
  }, [loadSessions]);

  const currentSession  = sessions.find((s) => s.current);
  const otherSessions   = sessions.filter((s) => !s.current);

  const handleRevokeClick = useCallback((s: Session) => {
    setRevokeTarget(s);
    setShowRevoke(true);
  }, []);

  const handleRevoked = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleRevokedAll = useCallback(() => {
    setSessions((prev) => prev.filter((s) => s.current));
  }, []);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-[16px]">
        <SessionSkeleton highlighted />
        <div className="flex flex-col gap-[10px]">
          {[1, 2].map((i) => <SessionSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]">

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-[12px]">
        <div>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-soft)" }}>
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
            {otherSessions.length > 0 && (
              <span style={{ color: "var(--muted)" }}>
                {" "}across {sessions.length} device{sessions.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => loadSessions(true)}
          disabled={refreshing}
          className="flex items-center gap-[5px] rounded-[8px] px-[8px] py-[5px] t-caption transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          style={{ color: "var(--muted)" }}
        >
          <RefreshCw className={cn("size-[11px]", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── Current session ─────────────────────────────────────────── */}
      {currentSession && (
        <div className="flex flex-col gap-[8px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
            Current session
          </p>
          <SessionCard session={currentSession} onRevokeClick={handleRevokeClick} />
        </div>
      )}

      {/* ── Other sessions ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between gap-[8px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
            Other sessions
            {otherSessions.length > 0 && (
              <span
                className="ml-[6px] inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold"
                style={{ background: "var(--panel-3)", color: "var(--text-soft)" }}
              >
                {otherSessions.length}
              </span>
            )}
          </p>
          {otherSessions.length > 0 && (
            <button
              onClick={() => setShowRevokeAll(true)}
              className="flex items-center gap-[5px] rounded-[8px] px-[8px] py-[5px] t-caption transition-colors hover:bg-[rgba(192,72,72,0.08)]"
              style={{ color: "var(--danger)" }}
            >
              <LogOut className="size-[11px]" />
              Sign out all
            </button>
          )}
        </div>

        {otherSessions.length === 0 ? (
          <div
            className="flex flex-col items-center gap-[10px] rounded-[var(--radius-lg)] py-[32px]"
            style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex size-[44px] items-center justify-center rounded-full"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
            >
              <Shield className="size-[20px]" style={{ color: "var(--accent-text)" }} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
                No other active sessions
              </p>
              <p className="mt-[4px] t-caption" style={{ color: "var(--muted)" }}>
                You&apos;re only signed in on this device.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {otherSessions.map((s) => (
              <SessionCard key={s.id} session={s} onRevokeClick={handleRevokeClick} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <RevokeModal
        open={showRevoke}
        onClose={() => { setShowRevoke(false); setRevokeTarget(null); }}
        session={revokeTarget}
        onRevoked={handleRevoked}
      />
      <RevokeAllModal
        open={showRevokeAll}
        onClose={() => setShowRevokeAll(false)}
        count={otherSessions.length}
        onRevoked={handleRevokedAll}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SessionSkeleton({ highlighted = false }: { highlighted?: boolean }) {
  return (
    <div
      className="flex items-center gap-[14px] rounded-[var(--radius-lg)] px-[16px] py-[14px]"
      style={{
        background: highlighted ? "rgba(139,92,246,0.04)" : "var(--panel-2)",
        border:     `1px solid ${highlighted ? "var(--accent-border)" : "var(--border)"}`,
      }}
    >
      <div
        className="size-[40px] flex-shrink-0 animate-pulse rounded-[var(--radius-md)]"
        style={{ background: "var(--panel-3)" }}
      />
      <div className="flex-1 flex flex-col gap-[6px]">
        <div className="h-[12px] w-[140px] animate-pulse rounded-full" style={{ background: "var(--panel-3)" }} />
        <div className="h-[10px] w-[100px] animate-pulse rounded-full" style={{ background: "var(--panel-3)" }} />
      </div>
      <div className="h-[28px] w-[70px] animate-pulse rounded-[8px]" style={{ background: "var(--panel-3)" }} />
    </div>
  );
}
