/**
 * Shared cookie name and options for the custom DB session token.
 * Used by login, register, and logout routes.
 */

export const SESSION_COOKIE = "session_token";

export function sessionCookieOptions(expires: Date): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  expires: Date;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Options used to clear the cookie on logout. */
export const SESSION_COOKIE_CLEAR: {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 0,
};
