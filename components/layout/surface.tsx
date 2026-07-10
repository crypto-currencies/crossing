import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: "default" | "tight";
  size?: "content" | "standard" | "hero" | "browse" | "dashboard" | "wide";
  "data-debug"?: string;
}

const pageShellSizeMap = {
  content: "920px",
  standard: "var(--page-max)",
  hero: "var(--page-max)",
  browse: "var(--page-max)",
  dashboard: "var(--page-max)",
  wide: "var(--page-max)",
};

export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, density = "default", size = "hero", style, "data-debug": dataDebug, ...props }, ref) => (
    <div
      ref={ref}
      data-debug={dataDebug ?? "ACTIVE_PAGESHELL_COMPONENT_V2"}
      className={cn(
        "relative min-w-0",
        density === "tight" ? "page-shell-tight" : "page-shell",
        className
      )}
      style={{
        "--page-shell-max-width": pageShellSizeMap[size],
        ...style,
      } as React.CSSProperties}
      {...props}
    />
  )
);
PageShell.displayName = "PageShell";

interface SectionShellProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: "none" | "tight" | "default" | "relaxed";
  header?: React.ReactNode;
}

const sectionSpacingMap = {
  none: "section-shell-none",
  tight: "section-shell-tight",
  default: "section-shell",
  relaxed: "section-shell-relaxed",
};

export const SectionShell = forwardRef<HTMLElement, SectionShellProps>(
  ({ className, spacing = "default", header, children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(sectionSpacingMap[spacing], className)}
      {...props}
    >
      {header}
      {children}
    </section>
  )
);
SectionShell.displayName = "SectionShell";

export const Section = SectionShell;
Section.displayName = "Section";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "soft" | "accent";
  padding?: "sm" | "md" | "lg";
}

const panelToneMap = {
  default: "panel",
  soft: "panel panel-soft",
  accent: "panel panel-accent",
};

const panelPaddingMap = {
  sm: "panel-padding-sm",
  md: "panel-padding-md",
  lg: "panel-padding-lg",
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, tone = "default", padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(panelToneMap[tone], panelPaddingMap[padding], className)}
      {...props}
    />
  )
);
Panel.displayName = "Panel";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-[20px]",
        className
      )}
      {...props}
    >
      <div className="stack-sm min-w-0">
        <h1 className="t-display-md">{title}</h1>
        {description && (
          <p className="t-body-sm text-[var(--text-soft)]">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-[20px]",
        className
      )}
      {...props}
    >
      <div className="stack-sm min-w-0">
        {eyebrow && <p className="t-subheading">{eyebrow}</p>}
        <h2 className="t-heading">{title}</h2>
        {description && <p className="t-body-sm text-[var(--text-soft)]">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
