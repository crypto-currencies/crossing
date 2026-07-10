"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRACE_PERIOD_DAYS = 7;

interface DeletionBannerProps {
  /** ISO timestamp of when deletion was scheduled. */
  scheduledAt: string;
}

/**
 * Shown across the dashboard while an account deletion is pending.
 * The user keeps full access during the grace period but is never silently
 * logged in without knowing their account is queued for permanent removal.
 */
export function DeletionBanner({ scheduledAt }: DeletionBannerProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletionDate = new Date(
    new Date(scheduledAt).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
  const dateLabel = deletionDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setError("Could not cancel — please try again or contact support.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not cancel — please try again or contact support.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      style={{
        background: "color-mix(in srgb, #ef4444 10%, var(--surface-raised))",
        borderBottom: "1px solid color-mix(in srgb, #ef4444 35%, transparent)",
      }}
    >
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#ef4444" }} />
        <p className="t-body-sm" style={{ color: "var(--text-primary)" }}>
          <strong>Account scheduled for deletion</strong> — your account and all
          data will be permanently erased on <strong>{dateLabel}</strong>.
          {error && <span style={{ color: "#ef4444" }}> {error}</span>}
        </p>
      </div>
      <Button variant="secondary" size="sm" loading={cancelling} onClick={handleCancel}>
        Cancel deletion
      </Button>
    </div>
  );
}
