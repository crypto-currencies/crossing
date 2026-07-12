"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  User,
  Lock,
  Bell,
  Monitor,
  Mail,
  UserX,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useToastStore } from "@/store/toast";
import { settingsService } from "@/lib/services/settings.service";
import { authService } from "@/lib/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { SessionsTab } from "@/components/settings/sessions-tab";
import type { NotificationSettings } from "@/types";

// ─── Nav config ───────────────────────────────────────────────────────────────

const PRIMARY_TABS = [
  { key: "account",       label: "Account",       icon: User    },
  { key: "security",      label: "Security",      icon: Lock    },
  { key: "sessions",      label: "Sessions",      icon: Monitor },
  { key: "notifications", label: "Notifications", icon: Bell    },
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
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────

function AccountTab() {
  const { user } = useAuthStore();
  const { success: toastSuccess } = useToastStore();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmText, password: password || undefined }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        const msg =
          json.error === "wrong_password"      ? "Incorrect password." :
          json.error === "password_required"    ? "Enter your password to confirm." :
          json.error === "confirmation_required" ? 'Type "DELETE" to confirm.' :
          json.error === "owner_cannot_delete"  ? "Transfer ownership before deleting your account." :
          "Failed to delete account. Please try again.";
        setDeleteError(msg);
        return;
      }
      toastSuccess("Account deleted");
      await authService.signOut();
      window.location.href = "/";
    } catch {
      setDeleteError("Network error — please try again.");
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

      <div className="rounded-[var(--radius-lg)] border border-[var(--danger)]/30 bg-[var(--panel)] p-[18px]">
        <p className="t-label text-[var(--danger)]">Delete account</p>
        <p className="t-body-sm mt-[4px] text-[var(--text-soft)]">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" className="mt-[12px]" onClick={() => setDeleteModalOpen(true)}>
          <UserX className="size-[13px]" /> Delete account
        </Button>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account?"
        description="This permanently deletes your account and all associated data. This cannot be undone."
        size="sm"
      >
        <div className="stack-sm">
          <Input
            label='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <Input
            type="password"
            label="Password (if set)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {deleteError && <p className="t-caption text-[var(--danger)]">{deleteError}</p>}
          <div className="flex justify-end gap-[8px] mt-[8px]">
            <Button variant="ghost" size="md" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="md"
              loading={deleting}
              disabled={confirmText !== "DELETE"}
              onClick={handleDelete}
            >
              Delete account
            </Button>
          </div>
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
  }, [user, toastError, toastSuccess]);

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
