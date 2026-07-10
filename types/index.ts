// Core domain types for Crossing.dev

/** Platform role. Omitted from public responses; present on own-user responses. */
export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "OWNER";

export interface User {
  id: string;
  name: string | null;
  /** Present for the authenticated user; omitted from public responses. */
  email?: string | null;
  /** ISO timestamp set when the user clicked the verification link. Null = unverified. */
  emailVerifiedAt?: string | null;
  /** Present for the authenticated user; omitted from public responses. */
  role?: UserRole;
  /** ISO timestamp when account deletion was requested. Null = not scheduled. Own-user only. */
  deletionScheduledAt?: string | null;
  image: string | null;
  verified: boolean;
  onboardingCompleted?: boolean;
  joinedAt: string;
}

export type UserStatus = "online" | "away" | "offline";

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

// Notifications

export type NotificationType = "system" | "verification";

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  title: string;
  body: string;
  href?: string;
  actorId?: string;
  actorAvatar?: string | null;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

// Settings

export interface UserSettings {
  userId: string;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushEnabled: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: string | null;
}

// UI types

export type Size = "xs" | "sm" | "md" | "lg" | "xl";
export type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type Intent = "default" | "success" | "warning" | "danger" | "info";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  exact?: boolean;
}

// Toast

export type ToastVariant = "default" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  variant: ToastVariant;
  duration?: number;
}
