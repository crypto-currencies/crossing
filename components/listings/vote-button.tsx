"use client";

import { ThumbsUp } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { useOptimisticToggle } from "./use-optimistic-toggle";

interface VoteButtonProps {
  listingSlug: string;
  listingName: string;
  initialVoted: boolean;
  initialCount: number;
  variant?: "icon" | "full";
  className?: string;
}

/**
 * Public label is "Recommend" — the product deliberately avoids exposing
 * "vote"/scoring mechanics to ordinary users (see docs/product-scope.md).
 */
export function VoteButton({
  listingSlug,
  listingName,
  initialVoted,
  initialCount,
  variant = "icon",
  className,
}: VoteButtonProps) {
  const { active, count, toggle } = useOptimisticToggle({
    listingSlug,
    endpoint: "vote",
    initialActive: initialVoted,
    initialCount,
    signInReason: `Sign in to recommend ${listingName}.`,
    errorMessage: "Couldn't update your recommendation. Try again.",
  });

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={active ? `Remove your recommendation for ${listingName}` : `Recommend ${listingName}`}
        title={active ? "Recommended" : "Recommend"}
        className={cn(
          "flex items-center gap-[5px] rounded-[var(--radius-sm)] px-[8px] h-8 flex-shrink-0",
          "border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)]",
          "transition-all duration-[120ms] hover:border-[var(--border-strong)] hover:text-[var(--text-soft)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
          active && "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent-text)]",
          className
        )}
      >
        <ThumbsUp className="size-[13px]" fill={active ? "currentColor" : "none"} />
        {count > 0 && <span className="text-[11px] tabular-nums">{formatNumber(count)}</span>}
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
        "text-[13px] font-medium !text-white",
        "bg-[#6d28d9] border border-[rgba(109,40,217,0.40)]",
        "hover:bg-[#7c3aed]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        active && "bg-[#5b21b6]",
        className
      )}
    >
      <ThumbsUp className="size-[15px]" fill={active ? "currentColor" : "none"} />
      {active ? "Recommended" : "Recommend"}
      {count > 0 && <span className="opacity-80 tabular-nums">{formatNumber(count)}</span>}
    </button>
  );
}
