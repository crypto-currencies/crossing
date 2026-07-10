import { cn } from "@/lib/utils";

interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  label?: string;
  className?: string;
}

export function Separator({
  orientation = "horizontal",
  label,
  className,
}: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div
        className={cn("w-px self-stretch bg-[var(--border)]", className)}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)} role="separator">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="t-caption flex-shrink-0">{label}</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>
    );
  }

  return (
    <div
      className={cn("h-px w-full bg-[var(--border)]", className)}
      role="separator"
    />
  );
}
