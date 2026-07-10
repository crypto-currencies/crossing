/**
 * Canonical route constants for Crossing.dev.
 */

const user = {
  dashboard:     "/dashboard",
  notifications: "/notifications",
  settings:      "/settings",
  support:       "/support",
} as const;

const admin = {
  dashboard:  "/control/admin",
  moderation: "/control/admin/moderation",
} as const;

const legal = {
  privacy:  "/privacy",
  terms:    "/terms",
  policies: "/policies",
  dmca:     "/dmca",
} as const;

const auth = {
  login:          "/login",
  register:       "/register",
  forgotPassword: "/forgot-password",
  resetPassword:  "/reset-password",
  oauthCallback:  "/oauth-callback",
} as const;

const root = {
  home:      "/",
  suspended: "/suspended",
} as const;

export const ROUTES = { user, admin, legal, auth, root } as const;

export const DEFAULT_REDIRECT          = ROUTES.user.dashboard;
export const DEFAULT_REDIRECT_NEW_USER = ROUTES.user.dashboard;
