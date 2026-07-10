import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "size-3 border",
  sm: "size-4 border-2",
  md: "size-5 border-2",
  lg: "size-7 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "rounded-full border-[var(--border-strong)] border-t-white animate-spin",
        sizeMap[size],
        className
      )}
      aria-label="Loading"
      role="status"
    />
  );
}

// Full-screen loading overlay
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-[12px] bg-[var(--bg)]">
      <Spinner size="lg" />
      {label && <p className="t-body-sm text-[var(--text-soft)]">{label}</p>}
    </div>
  );
}

// Inline loading placeholder
export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[8px] py-[40px]">
      <Spinner size="md" />
      {label && <p className="t-caption">{label}</p>}
    </div>
  );
}
