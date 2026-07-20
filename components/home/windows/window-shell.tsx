import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WindowShellProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

export function WindowShell({ icon: Icon, title, subtitle, className, children }: WindowShellProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-lg)]",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="t-label truncate text-[var(--text-primary)]">{title}</p>
          {subtitle && <p className="t-caption truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
