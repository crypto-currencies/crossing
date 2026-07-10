import { forwardRef } from "react";
import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { UserStatus } from "@/types";

const avatarVariants = cva(
  "relative inline-flex flex-shrink-0 rounded-full overflow-hidden bg-[var(--panel-2)] ring-2 ring-[var(--border)]",
  {
    variants: {
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
        xl: "size-16",
        "2xl": "size-20",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const statusColor: Record<UserStatus, string> = {
  online: "bg-[var(--success)]",
  away: "bg-[var(--warning)]",
  offline: "bg-[var(--muted)]",
};

const statusSize: Record<string, string> = {
  xs: "size-1.5 border",
  sm: "size-2 border",
  md: "size-2.5 border-2",
  lg: "size-3 border-2",
  xl: "size-3.5 border-2",
  "2xl": "size-4 border-[3px]",
};

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  status?: UserStatus;
  className?: string;
  style?: React.CSSProperties;
  /** Extra classes applied to the inner image container (controls clip shape). */
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  /** Extra classes applied to the status dot indicator. */
  statusClassName?: string;
  /** @deprecated use statusClassName instead */
  pulseClass?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt = "", fallback, status, size = "md", className, style, imgClassName, imgStyle, statusClassName, pulseClass }, ref) => {
    const initials = fallback
      ? fallback.slice(0, 2).toUpperCase()
      : alt.slice(0, 2).toUpperCase();

    const dotClass = statusClassName ?? pulseClass;

    return (
      <div ref={ref} className={cn("relative", className)} style={style}>
        <div className={cn(avatarVariants({ size }), imgClassName)} style={imgStyle}>
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span className="flex items-center justify-center w-full h-full text-[var(--muted)] font-medium text-xs">
              {initials || "?"}
            </span>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full border-[var(--bg)]",
              statusColor[status],
              statusSize[size ?? "md"],
              dotClass
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

// Avatar group — stacked avatars
interface AvatarGroupProps {
  users: Array<{ id: string; avatar?: string | null; username: string }>;
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
}

export function AvatarGroup({ users, max = 4, size = "sm", className }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const remainder = users.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((user) => (
        <Avatar
          key={user.id}
          src={user.avatar}
          alt={user.username}
          size={size}
          className="ring-2 ring-[var(--bg)]"
        />
      ))}
      {remainder > 0 && (
        <div
          className={cn(
            avatarVariants({ size }),
            "ring-2 ring-[var(--bg)] flex items-center justify-center"
          )}
        >
          <span className="text-[10px] font-medium text-[var(--muted)]">
            +{remainder}
          </span>
        </div>
      )}
    </div>
  );
}
