import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "badge font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel-2)] text-[var(--text-soft)] border border-[var(--border)]",
        accent:  "bg-[rgba(109,40,217,0.08)] text-[var(--accent-text)] border border-[rgba(109,40,217,0.18)]",
        success: "bg-[rgba(34,197,94,0.08)] text-[var(--success)] border border-[rgba(34,197,94,0.16)]",
        warning: "bg-[var(--panel-2)] text-[var(--warning)] border border-[var(--border)]",
        danger:  "bg-[var(--panel-2)] text-[var(--danger)] border border-[var(--border)]",
        premium: "bg-[rgba(109,40,217,0.10)] text-[var(--accent-text)] border border-[rgba(109,40,217,0.20)]",
        outline: "bg-transparent text-[var(--muted)] border border-[var(--border)]",
      },
      size: {
        xs: "t-caption px-[calc(var(--small-padding) / 1.75)] py-[calc(var(--small-padding) / 3.5)]",
        sm: "t-caption px-[calc(var(--small-padding) / 1.75)] py-[calc(var(--small-padding) / 3.5)]",
        md: "t-label px-[var(--small-padding)] py-[calc(var(--small-padding) / 1.75)]",
        lg: "t-body-sm px-[calc(var(--small-padding) + 2px)] py-[calc(var(--small-padding) / 1.75)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className="size-1.5 rounded-full bg-current flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";
