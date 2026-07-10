import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "card transition-[border-color,box-shadow,transform,background-color] duration-[120ms] ease-[var(--ease-out)]",
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--panel)] border-[var(--border)]",
        ],
        elevated: [
          "bg-[var(--panel-2)] border-[var(--border)] shadow-[var(--shadow-sm)]",
        ],
        overlay: [
          "bg-[var(--panel)] border-[var(--border)] shadow-[var(--shadow-md)]",
        ],
        ghost: [
          "bg-transparent border-[var(--border)] shadow-none",
        ],
        accent: [
          "bg-[var(--panel)] border-[var(--border-strong)]",
        ],
        interactive: [
          "bg-[var(--panel)] border-[var(--border)]",
          "hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--panel-2)]",
          "cursor-pointer",
        ],
      },
      padding: {
        none: "p-0",
        sm: "p-[14px]",
        md: "p-[20px]",
        lg: "p-[28px]",
        xl: "p-[36px]",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

// Sub-components for structured cards
export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between gap-[20px] mb-[20px]", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("t-heading text-[var(--text)]", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);
CardBody.displayName = "CardBody";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mt-[24px] pt-[20px] border-t border-[var(--border)] flex items-center gap-[12px]",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export const CardDivider = () => (
  <div className="h-px bg-[var(--border)] -mx-[calc(var(--small-padding) + 6px)] my-[24px]" />
);
