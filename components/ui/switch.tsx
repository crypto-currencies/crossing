"use client";

/**
 * Switch — canonical toggle control for the entire crossing.dev app.
 *
 * Design:
 *   On  → purple track + subtle ambient glow + white thumb
 *   Off → dark muted track + muted thumb
 *   Hover (on)  → brighter purple + stronger glow
 *   Hover (off) → slightly lifted track
 *   Focus → 3px semi-transparent purple ring (works on any dark bg)
 *   Disabled → 40% opacity, no pointer events
 *
 * Sizes:
 *   "md" (default) → 40 × 22 px  — settings, customizer rows
 *   "sm"           → 34 × 20 px  — compact inline contexts
 *
 * Usage:
 *   import { Switch } from "@/components/ui/switch";
 *   <Switch checked={value} onChange={setValue} />
 *   <Switch checked={value} onChange={setValue} size="sm" disabled />
 */

import { cn } from "@/lib/utils";

// ─── Size map ─────────────────────────────────────────────────────────────────

const SIZE = {
  md: {
    track:     "h-[22px] w-[40px]",
    thumb:     "size-[18px]",
    margin:    "m-[2px]",
    translate: "translate-x-[18px]",
  },
  sm: {
    track:     "h-[20px] w-[34px]",
    thumb:     "size-[16px]",
    margin:    "m-[2px]",
    translate: "translate-x-[14px]",
  },
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SwitchProps {
  /** Current on/off state. */
  checked: boolean;
  /**
   * Called with the new boolean state whenever the switch is toggled.
   * Named `onChange` (not `onCheckedChange`) for drop-in compatibility with
   * existing Toggle call sites throughout the codebase.
   */
  onChange: (checked: boolean) => void;
  /** Renders the switch at reduced opacity and blocks interaction. */
  disabled?: boolean;
  /** Accessible name — required when there is no adjacent visible label. */
  label?: string;
  /** "md" (40 × 22) | "sm" (34 × 20). Defaults to "md". */
  size?: keyof typeof SIZE;
  /** Extra classes applied to the track element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
  className,
}: SwitchProps) {
  const s = SIZE[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // ── Base layout ──────────────────────────────────────────────
        "relative inline-flex flex-shrink-0 rounded-full",
        s.track,
        // ── Transition ───────────────────────────────────────────────
        "transition-all duration-200 ease-in-out",
        // ── Focus ring — semi-transparent so it works on any bg ──────
        "focus-visible:outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-[rgba(139,92,246,0.55)]",
        // ── Disabled ─────────────────────────────────────────────────
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        // ── Track: ON ────────────────────────────────────────────────
        checked && [
          "bg-[var(--purple)]",
          "shadow-[0_0_0_0px_transparent,0_0_8px_rgba(139,92,246,0.28)]",
          !disabled && [
            "hover:bg-[var(--purple-strong)]",
            "hover:shadow-[0_0_12px_rgba(139,92,246,0.40)]",
          ],
        ],
        // ── Track: OFF ───────────────────────────────────────────────
        !checked && [
          "bg-[var(--panel-3)]",
          !disabled && "hover:brightness-[1.18]",
        ],
        className
      )}
    >
      <span
        className={cn(
          // ── Thumb ────────────────────────────────────────────────
          "inline-block rounded-full transition-all duration-200 ease-in-out",
          s.thumb,
          s.margin,
          "shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
          // ── Thumb: ON ──────────────────────────────────────────
          checked && ["bg-white", s.translate],
          // ── Thumb: OFF ─────────────────────────────────────────
          !checked && ["bg-[var(--text-soft)]", "translate-x-0"],
        )}
      />
    </button>
  );
}
