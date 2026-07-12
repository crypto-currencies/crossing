import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
  xl: "size-16",
} as const;

const RADIUS_MAP = {
  sm: "rounded-[10px]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  xl: "rounded-[var(--radius-lg)]",
} as const;

const TEXT_SIZE_MAP = {
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[19px]",
  xl: "text-[22px]",
} as const;

interface ListingLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

/**
 * No listing in the seed catalog has a real logoUrl yet (no image upload
 * flow exists for submissions) — every card renders the fallback tile in
 * practice today, so it has to look intentional, not like a broken image.
 */
export function ListingLogo({ logoUrl, name, size = "md", className }: ListingLogoProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative flex-shrink-0 overflow-hidden bg-[var(--panel-2)] border border-[var(--border)]",
          SIZE_MAP[size],
          RADIUS_MAP[size],
          className
        )}
      >
        <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center bg-[var(--panel-2)] border border-[var(--border)]",
        SIZE_MAP[size],
        RADIUS_MAP[size],
        className
      )}
      aria-hidden
    >
      <span className={cn("font-semibold text-[var(--text-soft)]", TEXT_SIZE_MAP[size])}>
        {initial}
      </span>
    </div>
  );
}
