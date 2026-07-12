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

export type NotificationType =
  | "system"
  | "verification"
  | "submission_approved"
  | "submission_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  title: string;
  body: string;
  href?: string;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

// Discovery domain

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface Category extends CategorySummary {
  description: string | null;
  position: number;
}

/**
 * Client-facing listing shape. Deliberately omits `rankingScore` — ranking
 * is an internal ordering signal, never a number shown to ordinary users
 * (see docs/ranking-v0.md). Cards/pages that need ranking *context* use a
 * boolean like `trending` instead of the raw score.
 */
export interface ListingCard {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  websiteUrl: string;
  publishedAt: string;
  saveCount: number;
  voteCount: number;
  category: CategorySummary;
}

export interface ListingDetail extends ListingCard {
  description: string;
  createdAt: string;
  submittedBy: { id: string; name: string | null; image: string | null } | null;
}

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Submission {
  id: string;
  name: string;
  websiteUrl: string;
  tagline: string;
  description: string;
  status: SubmissionStatus;
  moderatorNote: string | null;
  category: CategorySummary;
  createdAt: string;
  reviewedAt: string | null;
  listingSlug?: string | null;
}

/** Admin-only view of a submission — includes the submitter's identity. */
export interface AdminSubmission extends Submission {
  submittedBy: { id: string; name: string | null; email: string | null };
  reviewedBy: { id: string; name: string | null } | null;
}

// Settings

export interface NotificationSettings {
  emailNotifications: boolean;
  pushEnabled: boolean;
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
