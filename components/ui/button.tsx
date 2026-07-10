import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "button inline-flex items-center justify-center gap-[6px] font-medium",
    "transition-[transform,background-color,border-color,box-shadow,color,filter] duration-[120ms] ease-[var(--ease-out)]",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
    "disabled:pointer-events-none disabled:opacity-30 select-none cursor-pointer whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        // Solid flat purple — confident, not attention-seeking
        primary: [
          "!text-white",
          "bg-[#6d28d9]",
          "border border-[rgba(109,40,217,0.40)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.50)]",
          "hover:-translate-y-px hover:bg-[#7c3aed]",
          "hover:shadow-[0_4px_14px_rgba(0,0,0,0.40)]",
          "active:translate-y-0 active:bg-[#5b21b6]",
          "active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.40)]",
        ],
        // Neutral dark surface — clean, understated
        secondary: [
          "!text-[var(--text)] bg-[var(--panel-2)] border border-[var(--border-strong)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.36)]",
          "hover:-translate-y-px hover:bg-[var(--panel-3)] hover:border-[rgba(255,255,255,0.12)]",
          "hover:shadow-[0_4px_12px_rgba(0,0,0,0.32)]",
          "active:translate-y-0 active:bg-[var(--panel)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.50)]",
        ],
        ghost: [
          "!text-[var(--text-soft)] bg-transparent border border-transparent shadow-none",
          "hover:bg-[rgba(255,255,255,0.04)] hover:border-[var(--border)] hover:text-[var(--text)]",
          "active:bg-[rgba(0,0,0,0.28)]",
        ],
        outline: [
          "border border-[var(--border)] !text-[var(--text-soft)] bg-transparent shadow-none",
          "hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text)]",
          "active:translate-y-0 active:bg-[rgba(0,0,0,0.28)]",
        ],
        danger: [
          "bg-[var(--danger)] !text-white border border-[rgba(255,255,255,0.12)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.40)]",
          "hover:-translate-y-px hover:brightness-110",
          "active:translate-y-0 active:brightness-90",
        ],
        link: [
          "!text-[var(--text-soft)] underline-offset-4 bg-transparent border-none shadow-none",
          "hover:underline hover:text-[var(--accent-text)]",
          "hover:translate-y-0 active:translate-y-0 p-0 h-auto",
        ],
      },
      size: {
        xs: "h-[26px] px-[8px] text-[11px] rounded-[10px]",
        sm: "h-[30px] px-[11px] text-[12px] rounded-[10px]",
        md: "h-[34px] px-[14px] text-[13px] rounded-[11px]",
        lg: "h-[38px] px-[18px] text-[13px] rounded-[12px]",
        xl: "h-[44px] px-[22px] text-[14px] rounded-[13px]",
        icon: "size-[34px] p-0 rounded-[10px]",
        "icon-sm": "size-[28px] p-0 rounded-[9px]",
        "icon-lg": "size-[38px] p-0 rounded-[11px]",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      asChild,
      ...props
    },
    ref
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
export { buttonVariants };
