"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Mini Browser Card ────────────────────────────────────────────────────────
// Dark app window with macOS-style chrome and shimming content blocks

export function MiniBrowserCard({
  className,
  children,
  tilt = true,
}: {
  className?: string;
  children?: React.ReactNode;
  tilt?: boolean;
}) {
  return (
    <motion.div
      className={cn("glass-card overflow-hidden select-none", className)}
      whileHover={
        tilt
          ? { rotateX: -2, rotateY: 3, y: -5, scale: 1.018 }
          : { y: -4 }
      }
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-[5px] border-b border-white/[0.055] bg-white/[0.018] px-[10px] py-[7px]">
        <span className="size-[7px] rounded-full bg-[rgba(255,255,255,0.20)]" />
        <span className="size-[7px] rounded-full bg-[rgba(255,255,255,0.20)]" />
        <span className="size-[7px] rounded-full bg-[rgba(255,255,255,0.20)]" />
        <div className="ml-auto flex items-center gap-[5px]">
          <div className="h-[3px] w-[52px] rounded-full bg-white/[0.07]" />
          <div className="size-[4px] rounded-full bg-[var(--purple)]/30" />
        </div>
      </div>
      {children ?? <DefaultBrowserContent />}
    </motion.div>
  );
}

function DefaultBrowserContent() {
  return (
    <div className="space-y-[6px] p-[10px]">
      {/* Profile row */}
      <div className="flex items-center gap-[7px]">
        <div className="size-8 flex-shrink-0 rounded-[7px] border border-[var(--purple)]/20 bg-[var(--purple)]/12" />
        <div className="flex-1 space-y-[5px]">
          <div
            className="h-[5px] rounded-full bg-[var(--purple)]"
            style={{ width: "62%", opacity: 0.65 }}
          />
          <div className="h-[3px] w-[38%] rounded-full bg-white/14" />
        </div>
        <div className="size-[6px] rounded-full bg-[var(--success)] opacity-80" />
      </div>
      {/* Mini stat tiles */}
      <div className="grid grid-cols-3 gap-[4px]">
        {[
          { w: "62%", op: 0.55 },
          { w: "46%", op: 0.42 },
          { w: "78%", op: 0.65 },
        ].map(({ w, op }, i) => (
          <div
            key={i}
            className="rounded-[5px] border border-white/[0.05] bg-white/[0.03] p-[5px]"
          >
            <div
              className="mb-[3px] h-[4px] rounded-full bg-[var(--purple)]"
              style={{ width: w, opacity: op }}
            />
            <div className="h-[3px] w-[72%] rounded-full bg-white/10" />
          </div>
        ))}
      </div>
      {/* Shimmering progress bars */}
      {[
        { w: "75%", op: 0.65 },
        { w: "52%", op: 0.48 },
        { w: "88%", op: 0.38 },
      ].map(({ w, op }, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-full bg-white/[0.055]"
          style={{ height: 3 }}
        >
          <motion.div
            className="h-full rounded-full bg-[var(--purple)]"
            style={{ width: w, opacity: op }}
            animate={{ opacity: [op * 0.55, op, op * 0.55] }}
            transition={{
              duration: 2.4 + i * 0.55,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.38,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Cursor Bubble ────────────────────────────────────────────────────────────
// Cursor arrow inside a circular glow with float + ripple animations

export function CursorBubble({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = { sm: 34, md: 44, lg: 56 }[size];
  return (
    <motion.div
      className={cn("relative flex items-center justify-center", className)}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: dim + 20,
          height: dim + 20,
          background: `radial-gradient(circle, rgba(255,255,255,0.06), transparent 68%)`,
        }}
      />
      {/* Pulse ring */}
      <motion.div
        className="pointer-events-none absolute rounded-full border border-[var(--purple)]/25"
        style={{ width: dim + 6, height: dim + 6 }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.55, 0, 0.55] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Circle */}
      <div
        className="relative flex items-center justify-center rounded-full border border-[var(--purple)]/35 bg-[rgba(9,9,14,0.92)]"
        style={{ width: dim, height: dim }}
      >
        <CursorSVG size={Math.round(dim * 0.37)} />
      </div>
    </motion.div>
  );
}

function CursorSVG({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 14"
      fill="none"
      style={{ display: "block" }}
    >
      <path
        d="M1.5 1.5L10 6.8L6.8 8L5.2 12L1.5 1.5Z"
        fill="var(--purple)"
        stroke="var(--purple)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Profile Preview Graphic ──────────────────────────────────────────────────
// Compact profile card with avatar block, status dot, and mini stat bars

export function ProfilePreviewGraphic({
  className,
  accent = "var(--purple)",
}: {
  className?: string;
  accent?: string;
}) {
  return (
    <motion.div
      className={cn("glass-card overflow-hidden p-[10px]", className)}
      whileHover={{ y: -5, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className="flex items-center gap-[8px]">
        <div
          className="relative size-9 flex-shrink-0 rounded-[8px] border border-white/10"
          style={{ background: `linear-gradient(135deg, ${accent}28, ${accent}08)` }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="size-[14px] rounded-full"
              style={{ background: accent, opacity: 0.52 }}
            />
          </div>
          <span className="absolute -bottom-[2px] -right-[2px] size-[6px] rounded-full border border-[rgba(0,0,0,0.6)] bg-[var(--success)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="mb-[4px] h-[5px] rounded-full"
            style={{ width: "64%", background: accent, opacity: 0.62 }}
          />
          <div className="h-[3px] w-[40%] rounded-full bg-white/16" />
        </div>
      </div>
      <div className="mt-[8px] grid grid-cols-3 gap-[4px]">
        {["flw", "rep", "shw"].map((l, i) => (
          <div
            key={l}
            className="rounded-[4px] bg-white/[0.04] px-[5px] py-[4px] text-center"
          >
            <div
              className="mx-auto mb-[3px] h-[4px] rounded-full"
              style={{
                width: `${52 + i * 14}%`,
                background: accent,
                opacity: 0.38 + i * 0.16,
              }}
            />
            <span className="text-[7px] font-bold uppercase tracking-[0.06em] text-[rgba(255,255,255,0.28)]">
              {l}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Music Widget Graphic ─────────────────────────────────────────────────────
// Mini player with spinning disc, EQ bars, and animated progress

export function MusicWidgetGraphic({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("glass-card overflow-hidden p-[10px]", className)}
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      <div className="flex items-center gap-[8px]">
        <div className="relative flex size-8 flex-shrink-0 items-center justify-center rounded-[7px] border border-[rgba(29,185,84,0.18)] bg-[rgba(29,185,84,0.09)]">
          <motion.div
            className="size-[11px] rounded-full border-[1.5px] border-[rgba(29,185,84,0.7)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute size-[4px] rounded-full bg-[rgba(29,185,84,0.65)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-[3px] h-[5px] w-[68%] rounded-full bg-white/22" />
          <div className="h-[3px] w-[44%] rounded-full bg-white/12" />
        </div>
      </div>
      <div
        className="mt-[8px] flex items-end gap-[2px]"
        style={{ height: 14 }}
      >
        {[4, 7, 5, 10, 6, 9, 5, 7, 4, 8, 6, 9].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-full bg-[var(--purple)]"
            style={{ height: h, opacity: 0.7, transformOrigin: "bottom" }}
            animate={{ scaleY: [1, 1.8, 0.55, 1.5, 1] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.072,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div
        className="mt-[6px] overflow-hidden rounded-full bg-white/[0.07]"
        style={{ height: 2 }}
      >
        <motion.div
          className="h-full rounded-full bg-[var(--purple)]"
          style={{ opacity: 0.75 }}
          animate={{ width: ["18%", "72%", "18%"] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

// ─── Integration Grid Graphic ─────────────────────────────────────────────────
// 2×3 grid of platform placeholder blocks

const PLATFORM_GLYPHS = [
  { label: "DSC", color: "#8a8a8a" },
  { label: "TWI", color: "#8a8a8a" },
  { label: "SPO", color: "#8a8a8a" },
  { label: "STM", color: "#8a8a8a" },
  { label: "YT",  color: "#8a8a8a" },
  { label: "GH",  color: "#8a8a8a" },
];

export function IntegrationGridGraphic({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("glass-card overflow-hidden p-[8px]", className)}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      <div className="mb-[6px] flex items-center justify-between">
        <div className="h-[3px] w-[40px] rounded-full bg-[var(--purple)]/45" />
        <div className="flex items-center gap-[3px]">
          <span className="size-[4px] rounded-full bg-[var(--success)]" />
          <span
            className="text-[7px] font-bold"
            style={{ color: "var(--success)", opacity: 0.75 }}
          >
            linked
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[4px]">
        {PLATFORM_GLYPHS.map(({ label, color }, i) => (
          <motion.div
            key={label}
            className="flex items-center justify-center rounded-[5px] border border-white/[0.06] bg-white/[0.025] py-[6px]"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              delay: i * 0.24,
              ease: "easeInOut",
            }}
          >
            <span
              className="text-[7px] font-black tracking-[0.03em]"
              style={{ color }}
            >
              {label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Utility Glyphs ───────────────────────────────────────────────────────────
// Tiny decorative SVG markers — plus signs, corner brackets, dot grids, handles

export type GlyphType =
  | "plus"
  | "bracket-tl"
  | "bracket-br"
  | "dot"
  | "grid"
  | "handle";

export function UtilityGlyph({
  type,
  className,
}: {
  type: GlyphType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none inline-flex text-[var(--purple)] opacity-22",
        className
      )}
    >
      {type === "plus" && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1V9M1 5H9"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {type === "bracket-tl" && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M8 2H2V8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {type === "bracket-br" && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 8H8V2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {type === "dot" && (
        <svg width="5" height="5" viewBox="0 0 5 5" fill="none">
          <circle cx="2.5" cy="2.5" r="2" fill="currentColor" />
        </svg>
      )}
      {type === "grid" && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          {[0, 4, 8].flatMap((x) =>
            [0, 4, 8].map((y) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="2"
                height="2"
                rx="0.5"
                fill="currentColor"
              />
            ))
          )}
        </svg>
      )}
      {type === "handle" && (
        <svg width="10" height="5" viewBox="0 0 10 5" fill="none">
          <rect width="10" height="1.2" rx="0.6" fill="currentColor" />
          <rect y="3.8" width="10" height="1.2" rx="0.6" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────
// Small looping indicator dots

export function ProgressDots({
  count = 5,
  active = 0,
  className,
}: {
  count?: number;
  active?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-[4px]", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="rounded-full"
          style={{
            width: i === active ? 14 : 5,
            height: 5,
            background:
              i === active ? "var(--purple)" : "rgba(255,255,255,0.15)",
          }}
          animate={
            i === active
              ? { opacity: [0.7, 1, 0.7] }
              : {}
          }
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
