"use client";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
//  Crossing.dev brand mark system — "c." design
//
//  All marks share the same visual language as the favicon:
//    · White bold lowercase "c"
//    · Purple dot acting as the period
//    · Dark background (circle or transparent depending on variant)
//
//  LogoGlyph    — bare "c." on transparent bg. Use on coloured surfaces.
//  LogoMark     — "c." inside a dark circle. Nav, footer, compact headers.
//  LogoBadge    — large dark circle + purple glow ring. Auth, onboarding, splash.
//  Logo         — LogoMark + "crossing.dev" wordmark. Top nav bars.
//
//  SVG <text> inherits the page's loaded Inter font so the "c" glyph is
//  identical to the favicon at every render size.
// ─────────────────────────────────────────────────────────────────────────────

const PURPLE = "#7c3aed";
const WHITE  = "#ffffff";
const BG     = "#050506";
const FONT   = "Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif";

// ─── LogoGlyph ─────────────────────────────────────────────────────────────
// Bare "e." — no background. For avatar placeholders and coloured surfaces.

export function LogoGlyph({
  size = 24,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      style={style}
      aria-hidden="true"
    >
      {/* "c" — centred in the 32×32 space */}
      <text
        x="6"
        y="23"
        fontSize="19"
        fontWeight="800"
        fontFamily={FONT}
        fill={WHITE}
        letterSpacing="-0.03em"
      >
        c
      </text>
      {/* Purple dot — period, sits at the baseline of the "c" */}
      <circle cx="24" cy="21" r="3.5" fill={PURPLE} />
    </svg>
  );
}

// ─── LogoMark ─────────────────────────────────────────────────────────────────
// "e." inside a dark circle. Primary mark for nav, footer, and headers.
// Matches the favicon shape exactly.

export function LogoMark({
  size = 28,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      style={style}
      aria-hidden="true"
    >
      {/* Dark circle — matches favicon */}
      <circle cx="16" cy="16" r="16" fill={BG} />
      {/* Subtle purple ring */}
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(124,58,237,0.28)" strokeWidth="1" />
      {/* "c" */}
      <text
        x="6"
        y="23"
        fontSize="19"
        fontWeight="800"
        fontFamily={FONT}
        fill={WHITE}
        letterSpacing="-0.03em"
      >
        c
      </text>
      {/* Purple dot */}
      <circle cx="24" cy="21" r="3.5" fill={PURPLE} />
    </svg>
  );
}

// ─── LogoBadge ────────────────────────────────────────────────────────────────
// Large circular mark with optional glow. Auth panels, onboarding, splash.
// Uses a 64×64 viewBox — all coordinates are 2× the 32-space mark.

export function LogoBadge({
  size = 64,
  glow = true,
  className,
  style,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      style={style}
      aria-hidden="true"
    >
      {/* Outer glow halos */}
      {glow && (
        <>
          <circle cx="32" cy="32" r="31" stroke="rgba(124,58,237,0.08)" strokeWidth="4" />
          <circle cx="32" cy="32" r="31" stroke="rgba(124,58,237,0.16)" strokeWidth="2" />
        </>
      )}
      {/* Dark circle */}
      <circle cx="32" cy="32" r="29" fill={BG} />
      {/* Purple glow ring */}
      <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(124,58,237,0.50)" strokeWidth="1" />
      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(124,58,237,0.18)" strokeWidth="0.5" />
      {/* "c" — 2× scale: font-size 38, positioned to match 32-space mark */}
      <text
        x="12"
        y="46"
        fontSize="38"
        fontWeight="800"
        fontFamily={FONT}
        fill={WHITE}
        letterSpacing="-0.03em"
      >
        c
      </text>
      {/* Purple dot — 2× scale */}
      <circle cx="48" cy="42" r="7" fill={PURPLE} />
    </svg>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
// LogoMark + "crossing.dev" wordmark. Use in top nav bars.

export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-[9px]", className)}>
      <LogoMark size={size} />
      <span
        className="font-bold"
        style={{ fontSize: Math.round(size * 0.52), letterSpacing: "-0.01em" }}
      >
        <span className="text-[var(--text)]">crossing</span>
        <span style={{ color: PURPLE }}>.dev</span>
      </span>
    </span>
  );
}
