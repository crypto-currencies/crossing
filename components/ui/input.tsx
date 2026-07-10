import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      className,
      wrapperClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-[8px]", wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="t-label text-[var(--text-soft)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[var(--muted)] flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "input h-10",
              "t-body-sm text-[var(--text)] placeholder:text-[var(--muted)]",
              "px-[12px] py-[8px] transition-colors duration-[var(--motion-fast)]",
              "hover:border-[var(--border-strong)]",
              "focus:outline-none focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.07)]",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[var(--muted)] flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="t-caption text-[var(--danger)]">{error}</p>
        ) : hint ? (
          <p className="t-caption">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, wrapperClassName, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-[8px]", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="t-label text-[var(--text-soft)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "input",
            "t-body-sm text-[var(--text)] placeholder:text-[var(--muted)]",
            "px-[12px] py-[12px] transition-colors duration-[var(--motion-fast)] resize-y min-h-[92px]",
            "hover:border-[var(--border-strong)]",
            "focus:outline-none focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.07)]",
            error && "border-[var(--danger)]",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="t-caption text-[var(--danger)]">{error}</p>
        ) : hint ? (
          <p className="t-caption">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
