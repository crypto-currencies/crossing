"use client";

import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { useOptimisticToggle } from "./use-optimistic-toggle";

interface SaveButtonProps {
  listingSlug: string;
  listingName: string;
  initialSaved: boolean;
  initialCount: number;
  variant?: "icon" | "full";
  className?: string;
  /** Fires after a successful save/unsave — e.g. to drop the card from a "my saved" list. */
  onSettled?: (saved: boolean) => void;
}

export function SaveButton({
  listingSlug,
  listingName,
  initialSaved,
  initialCount,
  variant = "icon",
  className,
  onSettled,
}: SaveButtonProps) {
  const { active, count, toggle } = useOptimisticToggle({
    listingSlug,
    endpoint: "save",
    initialActive: initialSaved,
    initialCount,
    signInReason: `Sign in to save ${listingName}.`,
    errorMessage: "Couldn't update your saved listings. Try again.",
    onSettled,
  });

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={active ? `Remove ${listingName} from saved` : `Save ${listingName}`}
        title={active ? "Saved" : "Save"}
        className={cn(
          "flex size-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          "border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)]",
          "transition-all duration-[120ms] hover:border-[var(--border-strong)] hover:text-[var(--text-soft)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
          active && "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]",
          className
        )}
      >
        <Bookmark className="size-[14px]" fill={active ? "currentColor" : "none"} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      className={cn(
        "button inline-flex h-[38px] items-center justify-center gap-[7px] rounded-[12px] px-[16px]",
        "text-[13px] font-medium",
        "border border-[var(--border-strong)] bg-[var(--panel-2)] text-[var(--text)]",
        "hover:bg-[var(--panel-3)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        active && "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]",
        className
      )}
    >
      <Bookmark className="size-[15px]" fill={active ? "currentColor" : "none"} />
      {active ? "Saved" : "Save"}
      {count > 0 && (
        <span className="text-[var(--muted)] tabular-nums">{formatNumber(count)}</span>
      )}
    </button>
  );
}
