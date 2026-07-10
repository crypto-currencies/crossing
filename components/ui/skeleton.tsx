import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
}

export function Skeleton({ className, rounded = "md", ...props }: SkeletonProps) {
  const radiusMap = {
    sm: "rounded-[var(--radius-sm)]",
    md: "rounded-[var(--radius-md)]",
    lg: "rounded-[var(--radius-lg)]",
    xl: "rounded-[var(--radius-panel)]",
    full: "rounded-full",
  };

  return (
    <div
      className={cn(
        "bg-[var(--panel-2)] animate-pulse",
        radiusMap[rounded],
        className
      )}
      {...props}
    />
  );
}

// Preset skeleton patterns
export function SkeletonCard() {
  return (
    <div className="panel stack-md">
      <div className="flex items-center gap-[var(--small-padding)]">
        <Skeleton className="size-10 flex-shrink-0" rounded="full" />
        <div className="flex-1 stack-sm">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-[var(--small-padding)] py-[var(--small-padding)]">
      <Skeleton className="size-8 flex-shrink-0" rounded="full" />
      <div className="flex-1 stack-sm">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" rounded="md" />
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-4/5", "w-3/5", "w-2/3", "w-1/2"];
  return (
    <div className="stack-sm">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}
