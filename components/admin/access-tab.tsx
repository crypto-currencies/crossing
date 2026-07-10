"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  Crown,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Mail,
  KeyRound,
  Loader2,
} from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { getRoleChangePhrase, normalizePhrase } from "@/lib/admin-access";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccessUser {
  id:            string;
  name:          string | null;
  maskedEmail:   string | null;
  role:          string;
  verified:      boolean;
  suspended:     boolean;
  createdAt:     string;
  roleChangedAt: string | null;
  grantedBy:     { id: string; name: string | null } | null;
  avatarUrl:     string | null;
}

type TargetRole   = "ADMIN" | "MODERATOR" | "USER";
type TargetAction = "grant" | "revoke";

interface PendingChange {
  user:    AccessUser;
  role:    TargetRole;
  action:  TargetAction;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  OWNER:     { label: "Owner",     color: "var(--accent-text)", icon: Crown      },
  ADMIN:     { label: "Admin",     color: "var(--warning)",     icon: ShieldCheck },
  MODERATOR: { label: "Moderator", color: "var(--purple)",      icon: Shield      },
  USER:      { label: "User",      color: "var(--muted)",       icon: UserIcon    },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? ROLE_META.USER;
  const Icon = meta.icon;
  return (
    <span
      className="flex items-center gap-[4px] px-[7px] py-[2px] rounded-full t-caption font-semibold"
      style={{
        color:      meta.color,
        background: `${meta.color}18`,
        border:     `1px solid ${meta.color}30`,
      }}
    >
      <Icon className="size-[10px]" />
      {meta.label}
    </span>
  );
}

// Phrase generation is in lib/admin-access.ts — the same module used by the API route.
// Do not add a local expectedPhrase() function; use getRoleChangePhrase() directly.

// ─── Role change modal ────────────────────────────────────────────────────────

function RoleChangeModal({
  pending,
  onClose,
  onSuccess,
}: {
  pending:   PendingChange;
  onClose:   () => void;
  onSuccess: (userId: string, newRole: string) => void;
}) {
  const [step, setStep]           = useState<"phrase" | "otp" | "done">("phrase");
  const [phrase, setPhrase]       = useState("");
  const [otp, setOtp]             = useState("");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [, startT]                = useTransition();

  const expected = getRoleChangePhrase(pending.action, pending.role, pending.user.name);
  const phraseOk = normalizePhrase(phrase) === normalizePhrase(expected);

  // ── Step 1: verify phrase → request OTP ───────────────────────────────────
  const requestCode = useCallback(() => {
    if (!phraseOk) return;
    setErrorMsg(null);
    startT(async () => {
      try {
        const res = await fetch("/api/admin/access/request-code", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: pending.user.id,
            targetRole:   pending.role,
            action:       pending.action,
          }),
        });
        const json = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok) {
          setErrorMsg(json.error ?? `Server error (${res.status})`);
          return;
        }
        setStep("otp");
      } catch {
        setErrorMsg("Network error — please try again.");
      }
    });
  }, [phraseOk, pending]);

  // ── Step 2: submit OTP + phrase → apply role ───────────────────────────────
  const applyRole = useCallback(() => {
    if (otp.length !== 6) return;
    setErrorMsg(null);
    startT(async () => {
      try {
        const res = await fetch(
          `/api/admin/access/users/${pending.user.id}/role`,
          {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role:          pending.role,
              action:        pending.action,
              code:          otp.trim(),
              confirmPhrase: expected,
            }),
          }
        );
        const json = await res.json() as { ok?: boolean; error?: string; newRole?: string };
        if (!res.ok) {
          const msg =
            json.error === "invalid_code"      ? "Incorrect code. Check the digits and try again." :
            json.error === "expired_code"      ? "This code has expired. Go back and send a new one." :
            json.error === "code_already_used" ? "This code was already used. Send a new one." :
            json.error === "wrong_phrase"      ? "Confirmation phrase mismatch." :
            json.error ?? `Server error (${res.status})`;
          setErrorMsg(msg);
          return;
        }
        setStep("done");
        onSuccess(pending.user.id, json.newRole ?? pending.role);
      } catch {
        setErrorMsg("Network error — please try again.");
      }
    });
  }, [expected, onSuccess, otp, pending]);

  const actionVerb =
    pending.action === "grant"
      ? `Grant ${pending.role.charAt(0) + pending.role.slice(1).toLowerCase()}`
      : pending.role === "USER"
        ? "Revoke access"
        : `Revoke ${pending.role.charAt(0) + pending.role.slice(1).toLowerCase()}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${actionVerb} — ${pending.user.name ?? pending.user.id}`}
      description="Role changes require email verification. This action is logged."
      size="sm"
    >
      <div className="flex flex-col gap-[18px]">

        {/* ── Step: phrase ─────────────────────────────────────────────── */}
        {step === "phrase" && (
          <>
            <div className="flex flex-col gap-[8px]">
              <p className="t-body-sm text-[var(--text-soft)]">
                Type the following phrase exactly to confirm this action:
              </p>
              <div
                className="rounded-[var(--radius-md)] px-[12px] py-[10px] font-mono t-body-sm"
                style={{ background: "var(--panel-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                {expected}
              </div>
            </div>

            <div className="flex flex-col gap-[4px]">
              <Input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={expected}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              {phrase.length > 0 && !phraseOk && (
                <p className="t-caption text-[var(--danger)]">Phrase does not match.</p>
              )}
              {phraseOk && (
                <p className="flex items-center gap-[4px] t-caption text-[var(--success)]">
                  <CheckCircle2 className="size-3" /> Phrase confirmed.
                </p>
              )}
            </div>

            {errorMsg && (
              <p className="flex items-center gap-[6px] t-caption text-[var(--danger)]">
                <AlertTriangle className="size-3.5" /> {errorMsg}
              </p>
            )}

            <div className="flex justify-end gap-[8px]">
              <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                size="md"
                disabled={!phraseOk}
                onClick={requestCode}
              >
                <Mail className="size-3.5" />
                Send verification code
              </Button>
            </div>
          </>
        )}

        {/* ── Step: OTP ────────────────────────────────────────────────── */}
        {step === "otp" && (
          <>
            <div
              className="flex items-start gap-[10px] rounded-[var(--radius-md)] px-[12px] py-[10px]"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Mail className="size-4 text-[var(--accent-text)] flex-shrink-0 mt-[1px]" />
              <p className="t-body-sm text-[var(--text-soft)]">
                A 6-digit code was sent to <strong className="text-[var(--text)]">admins@crossing.dev</strong>.
                It expires in 10 minutes and can only be used once.
              </p>
            </div>

            <div className="flex flex-col gap-[4px]">
              <label className="t-caption text-[var(--muted)]">Verification code</label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="font-mono text-center tracking-[0.3em] text-[18px]"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            {errorMsg && (
              <p className="flex items-center gap-[6px] t-caption text-[var(--danger)]">
                <AlertTriangle className="size-3.5" /> {errorMsg}
              </p>
            )}

            <div className="flex justify-between gap-[8px]">
              <button
                type="button"
                className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors"
                onClick={() => { setStep("phrase"); setOtp(""); setErrorMsg(null); }}
              >
                ← Back
              </button>
              <div className="flex gap-[8px]">
                <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={otp.length !== 6}
                  onClick={applyRole}
                >
                  <KeyRound className="size-3.5" />
                  Apply role change
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: done ───────────────────────────────────────────────── */}
        {step === "done" && (
          <>
            <div className="flex flex-col items-center gap-[12px] py-[12px]">
              <CheckCircle2 className="size-10 text-[var(--success)]" />
              <div className="text-center">
                <p className="t-label text-[var(--text)]">Role updated</p>
                <p className="t-body-sm text-[var(--text-soft)] mt-[4px]">
                  {pending.user.name ?? pending.user.id} is now{" "}
                  <strong>{pending.role.charAt(0) + pending.role.slice(1).toLowerCase()}</strong>.
                  The change has been logged.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserAccessCard({
  user,
  onRoleChange,
}: {
  user:         AccessUser;
  onRoleChange: (pending: PendingChange) => void;
}) {
  const isProtected = user.role === "OWNER";

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[14px] flex flex-col gap-[12px]"
    >
      {/* Top row: avatar + identity + role badge */}
      <div className="flex items-center gap-[10px]">
        <div className="size-9 rounded-full bg-[var(--panel-2)] border border-[var(--border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
          {user.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="t-caption text-[var(--muted)]">
                {(user.name ?? "?")[0]?.toUpperCase()}
              </span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className="t-body-sm font-semibold text-[var(--text)] truncate">
              {user.name ?? user.id}
            </span>
          </div>
          {user.maskedEmail && (
            <p className="t-caption text-[var(--muted)] truncate">{user.maskedEmail}</p>
          )}
        </div>
        <RoleBadge role={user.role} />
      </div>

      {/* Role history */}
      {user.roleChangedAt && (
        <div className="flex items-center gap-[6px] t-caption text-[var(--muted)]">
          <Shield className="size-3 flex-shrink-0" />
          <span>
            Role last changed {relativeTime(user.roleChangedAt)}
            {user.grantedBy
              ? ` by ${user.grantedBy.name ?? user.grantedBy.id}`
              : ""}
          </span>
        </div>
      )}

      {/* Protected notice */}
      {isProtected && (
        <div className="flex items-center gap-[6px] t-caption text-[var(--accent-text)]">
          <Crown className="size-3 flex-shrink-0" />
          Owner account — role cannot be changed through this panel.
        </div>
      )}

      {/* Action buttons */}
      {!isProtected && (
        <div className="flex flex-wrap gap-[6px] pt-[2px]">
          {user.role !== "MODERATOR" && (
            <button
              type="button"
              onClick={() => onRoleChange({ user, role: "MODERATOR", action: "grant" })}
              className="flex items-center gap-[5px] px-[9px] py-[5px] rounded-[var(--radius-md)] t-caption font-medium border border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--purple)] hover:text-[var(--purple)] transition-colors"
            >
              <Shield className="size-3" />
              Grant Moderator
            </button>
          )}
          {user.role !== "ADMIN" && (
            <button
              type="button"
              onClick={() => onRoleChange({ user, role: "ADMIN", action: "grant" })}
              className="flex items-center gap-[5px] px-[9px] py-[5px] rounded-[var(--radius-md)] t-caption font-medium border border-[var(--border)] text-[var(--text-soft)] hover:border-[var(--warning)] hover:text-[var(--warning)] transition-colors"
            >
              <ShieldCheck className="size-3" />
              Grant Admin
            </button>
          )}
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <button
              type="button"
              onClick={() => onRoleChange({ user, role: "USER", action: "revoke" })}
              className="flex items-center gap-[5px] px-[9px] py-[5px] rounded-[var(--radius-md)] t-caption font-medium border border-[var(--border)] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[rgba(192,72,72,0.08)] transition-colors"
            >
              <ShieldOff className="size-3" />
              Revoke access
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main AccessTab ───────────────────────────────────────────────────────────

export function AccessTab() {
  const [query,   setQuery]   = useState("");
  const [loading, startLoad]  = useTransition();
  const [results, setResults] = useState<AccessUser[] | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) return;
    setError(null);
    startLoad(async () => {
      try {
        const res = await fetch(`/api/admin/access/users/search?q=${encodeURIComponent(q.trim())}`);

        // Always parse as text first — the server might return HTML or empty body on crashes
        const text = await res.text();
        let json: { users?: AccessUser[]; error?: string; message?: string } = {};
        try {
          json = text ? JSON.parse(text) as typeof json : {};
        } catch {
          // Non-JSON response — likely a server crash or HTML error page
          setError(
            `Server error (${res.status}) — check server logs. Try restarting the dev server if this persists.`
          );
          setResults(null);
          return;
        }

        if (!res.ok) {
          const msg =
            json.error === "forbidden"      ? "Access denied. Only the OWNER can manage roles." :
            json.error === "query_too_short" ? "Search query must be at least 2 characters."    :
            json.message                     ? json.message                                      :
            json.error                       ? json.error                                        :
            `Server error (${res.status})`;
          setError(msg);
          setResults(null);
        } else {
          setResults(json.users ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error — please try again.");
        setResults(null);
      }
    });
  }, []);

  const handleSuccess = useCallback((userId: string, newRole: string) => {
    setResults((prev) =>
      prev ? prev.map((u) => u.id === userId
        ? { ...u, role: newRole, roleChangedAt: new Date().toISOString(), grantedBy: null }
        : u
      ) : prev
    );
    setPending(null);
  }, []);

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Info banner */}
      <div
        className="flex items-start gap-[10px] rounded-[var(--radius-lg)] px-[14px] py-[12px]"
        style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)" }}
      >
        <ShieldCheck className="size-4 text-[var(--accent-text)] flex-shrink-0 mt-[1px]" />
        <div className="t-body-sm text-[var(--text-soft)]">
          <strong className="text-[var(--text)]">Role changes require email verification.</strong>{" "}
          Every grant and revoke sends a one-time code to{" "}
          <span className="text-[var(--text)]">admins@crossing.dev</span> and is permanently logged.
          OWNER status cannot be granted through this panel.
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); search(query); }}
        className="flex gap-[8px]"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or user ID…"
          leftIcon={loading ? <Loader2 className="size-[13px] animate-spin" /> : <Search className="size-[13px]" />}
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
          Search
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-[8px] rounded-[10px] px-[12px] py-[10px] t-body-sm"
          style={{ background: "rgba(192,72,72,0.08)", border: "1px solid rgba(192,72,72,0.2)", color: "var(--danger)" }}
        >
          <AlertTriangle className="size-[13px] flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        results.length === 0 ? (
          <div
            className="flex flex-col items-center gap-[10px] rounded-[var(--radius-lg)] py-[40px] text-center"
            style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
          >
            <Search className="size-5 text-[var(--muted)]" />
            <p className="t-body-sm text-[var(--muted)]">No users found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[8px]">
            <p className="t-caption text-[var(--muted)]">{results.length} result{results.length !== 1 ? "s" : ""}</p>
            {results.map((u) => (
              <UserAccessCard key={u.id} user={u} onRoleChange={setPending} />
            ))}
          </div>
        )
      )}

      {/* Role change modal */}
      {pending && (
        <RoleChangeModal
          pending={pending}
          onClose={() => setPending(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
