"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  User,
  Lock,
  Bell,
  LifeBuoy,
  Monitor,
  Shield,
  Mail,
  Copy,
  Check,
  Download,
  UserX,
  KeyRound,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useToastStore } from "@/store/toast";
import { settingsService } from "@/lib/services/settings.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { SessionsTab } from "@/components/settings/sessions-tab";
import type { NotificationSettings } from "@/types";

// ─── Nav config ───────────────────────────────────────────────────────────────

const PRIMARY_TABS = [
  { key: "account",       label: "Account",       icon: User     },
  { key: "security",      label: "Security",      icon: Lock     },
  { key: "sessions",      label: "Sessions",      icon: Monitor  },
  { key: "notifications", label: "Notifications", icon: Bell     },
  { key: "support",       label: "Support",       icon: LifeBuoy },
] as const;

type TabKey = typeof PRIMARY_TABS[number]["key"];

export function SettingsClient() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) ?? "account";
  const [tab, setTab] = useState<TabKey>(
    PRIMARY_TABS.some((t) => t.key === initialTab) ? initialTab : "account"
  );

  return (
    <div className="page-stack">
      <div className="flex flex-wrap gap-[6px] border-b border-[var(--border)] pb-[12px]">
        {PRIMARY_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-[6px] rounded-[var(--radius-md)] px-[12px] py-[7px] text-[13px] font-medium transition-colors",
              tab === key
                ? "bg-[rgba(255,255,255,0.06)] text-[var(--text)]"
                : "text-[var(--muted)] hover:text-[var(--text-soft)]"
            )}
          >
            <Icon className="size-[14px]" />
            {label}
          </button>
        ))}
      </div>

      {tab === "account"       && <AccountTab />}
      {tab === "security"      && <SecurityTab />}
      {tab === "sessions"      && <SessionsTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "support"       && <SupportTab />}
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────

function AccountTab() {
  const { user } = useAuthStore();
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "account-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess("Export ready", "Your data download has started.");
    } catch {
      toastError("Export failed", "Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      toastSuccess("Deletion scheduled", "Your account will be deleted in 7 days.");
      setDeleteModalOpen(false);
    } catch {
      toastError("Failed to schedule deletion", "Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="stack-lg max-w-[560px]">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)]">Name</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">{user?.name ?? "—"}</p>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)]">Email</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">{user?.email ?? "—"}</p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)]">Export your data</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
          Download a copy of your account data.
        </p>
        <Button variant="secondary" size="sm" className="mt-[12px]" loading={exporting} onClick={handleExport}>
          <Download className="size-[13px]" /> Export data
        </Button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--danger)]/30 bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--danger)]">Delete account</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
          Permanently delete your account and all associated data after a 7-day grace period.
        </p>
        <Button variant="danger" size="sm" className="mt-[12px]" onClick={() => setDeleteModalOpen(true)}>
          <UserX className="size-[13px]" /> Delete account
        </Button>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account?"
        description="Your account will be permanently deleted after a 7-day grace period. You can cancel any time before then."
        size="sm"
      >
        <div className="flex justify-end gap-[8px]">
          <Button variant="ghost" size="md" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" size="md" loading={deleting} onClick={handleDelete}>Delete account</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────

function SecurityTab() {
  const { user } = useAuthStore();
  const { success: toastSuccess, error: toastError } = useToastStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/security-status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setTwoFactorEnabled(!!data.twoFactorEnabled); })
      .catch(() => {});
  }, []);

  async function handleChangePassword() {
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error();
      toastSuccess("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toastError("Failed to change password", "Check your current password and try again.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function startTotpSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/totp/setup", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setManualKey(data.manualKey);
      setSetupOpen(true);
    } catch {
      toastError("Failed to start setup", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTotpSetup() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/totp/enable", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBackupCodes(data.backupCodes);
      setTwoFactorEnabled(true);
      toastSuccess("Two-factor authentication enabled");
    } catch {
      toastError("Invalid code", "Please check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disableTotp() {
    setBusy(true);
    try {
      const res = await fetch("/api/2fa/totp/disable", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error();
      setTwoFactorEnabled(false);
      toastSuccess("Two-factor authentication disabled");
    } catch {
      toastError("Invalid code", "Please check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg max-w-[560px]">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)]">Change password</p>
        <div className="stack-sm mt-[12px]">
          <Input type="password" label="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <Input type="password" label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Button variant="primary" size="sm" loading={changingPassword} onClick={handleChangePassword}>
            <KeyRound className="size-[13px]" /> Update password
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="t-label text-[var(--text)]">Two-factor authentication</p>
            <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
              Require a code from your authenticator app when signing in.
            </p>
          </div>
          <Badge variant={twoFactorEnabled ? "success" : "outline"} size="xs">
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <div className="mt-[12px]">
          {!twoFactorEnabled ? (
            <Button variant="secondary" size="sm" loading={busy} onClick={startTotpSetup}>
              <QrCode className="size-[13px]" /> Set up 2FA
            </Button>
          ) : (
            <div className="stack-sm">
              <Input label="Enter code to disable" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <Button variant="danger" size="sm" loading={busy} onClick={disableTotp}>Disable 2FA</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up two-factor authentication" size="md">
        <div className="stack-md">
          {qrCodeDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCodeDataUrl} alt="TOTP QR code" className="mx-auto rounded-[var(--radius-md)]" />
          )}
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-2)] px-[10px] py-[8px]">
            <span className="font-mono text-[12px]">{manualKey}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(manualKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-[var(--muted)] hover:text-[var(--text)]"
            >
              {copied ? <Check className="size-[14px]" /> : <Copy className="size-[14px]" />}
            </button>
          </div>
          {!backupCodes ? (
            <>
              <Input label="Enter code from your app" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <Button variant="primary" size="md" loading={busy} onClick={confirmTotpSetup}>Confirm</Button>
            </>
          ) : (
            <div className="stack-sm">
              <p className="t-body-sm text-[var(--text-soft)]">
                Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-[6px] font-mono text-[12px]">
                {backupCodes.map((c) => <span key={c} className="rounded-[6px] border border-[var(--border)] bg-[var(--panel-2)] px-[8px] py-[4px]">{c}</span>)}
              </div>
              <Button variant="primary" size="md" onClick={() => setSetupOpen(false)}>Done</Button>
            </div>
          )}
        </div>
      </Modal>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)]">Email verification</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
          {user?.emailVerifiedAt ? "Your email is verified." : "Your email is not verified yet."}
        </p>
        {!user?.emailVerifiedAt && (
          <Button variant="secondary" size="sm" className="mt-[12px]" onClick={async () => {
            try {
              const res = await fetch("/api/auth/verify-email/resend", { method: "POST", credentials: "include" });
              if (!res.ok) throw new Error();
              toastSuccess("Verification email sent");
            } catch {
              toastError("Failed to send email", "Please try again.");
            }
          }}>
            <Mail className="size-[13px]" /> Resend verification email
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsTab() {
  const { user } = useAuthStore();
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushEnabled: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/notifications", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.prefs) setSettings(data.prefs); })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback(async (patch: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      await settingsService.updateNotifications(user?.id ?? "", patch);
    } catch {
      toastError("Failed to save", "Please try again.");
      return;
    }
    toastSuccess("Saved");
  }, [user?.id, toastError, toastSuccess]);

  if (!loaded) return null;

  return (
    <div className="stack-md max-w-[560px]">
      <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <div>
          <p className="t-label text-[var(--text)]">Email notifications</p>
          <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">Receive account and activity emails.</p>
        </div>
        <Switch checked={settings.emailNotifications} onChange={(v) => update({ emailNotifications: v })} />
      </div>
      <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <div>
          <p className="t-label text-[var(--text)]">Push notifications</p>
          <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">Receive browser push notifications.</p>
        </div>
        <Switch checked={settings.pushEnabled} onChange={(v) => update({ pushEnabled: v })} />
      </div>
    </div>
  );
}

// ─── Support ──────────────────────────────────────────────────────────────────

function SupportTab() {
  return (
    <div className="stack-md max-w-[560px]">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--text)] flex items-center gap-[6px]">
          <Shield className="size-[14px]" /> Need help?
        </p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
          Visit the support page to open a ticket with our team.
        </p>
        <Button variant="secondary" size="sm" className="mt-[12px]" asChild>
          <a href="/support">Go to support</a>
        </Button>
      </div>
    </div>
  );
}
