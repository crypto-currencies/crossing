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
  dashboard: "/control/admin",
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

const site = {
  business:              "/business",
  businessPricing:       "/business/pricing",
  pricing:               "/pricing",
  contribute:            "/contribute",
  journal:               "/journal",
  about:                 "/about",
  cookies:               "/cookies",
  promotionDisclosure:   "/promotion-disclosure",
} as const;

const discovery = {
  search:      "/search",
  category:    (slug: string) => `/category/${slug}`,
  listing:     (slug: string) => `/listing/${slug}`,
  saved:       "/saved",
  submit:      "/submit",
  submissions: "/submissions",
} as const;

export const ROUTES = { user, admin, legal, auth, root, discovery, site } as const;

export const DEFAULT_REDIRECT          = ROUTES.user.dashboard;
export const DEFAULT_REDIRECT_NEW_USER = ROUTES.user.dashboard;
