import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black-950",
  {
    variants: {
      variant: {
        primary: "bg-sky-500 text-black-950 hover:bg-sky-400 active:bg-sky-600",
        secondary:
          "bg-navy-600 text-white-950 hover:bg-navy-500 active:bg-navy-700 border border-navy-400",
        outline:
          "border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-white-100/5",
        ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white-100/5",
        link: "text-sky-500 hover:text-sky-400 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, iconLeft, iconRight, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
        {iconLeft}
        {children}
        {iconRight}
      </button>
    );
  }
);
Button.displayName = "Button";
