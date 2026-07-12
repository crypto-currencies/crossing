import type { Session, User } from "@/types";
import { authHeaders } from "./utils";
import { useAuthStore } from "@/store/auth";

export interface SignInInput {
  identifier: string; // email
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
  isNewUser?: boolean;
}

function toSession(r: AuthResponse): Session & { isNewUser?: boolean } {
  return { token: r.token, expiresAt: r.expiresAt, user: r.user, isNewUser: r.isNewUser };
}

export const authService = {
  /**
   * Sign in with email + password.
   * Throws an Error whose message is the API error code.
   */
  async signIn(input: SignInInput): Promise<Session> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: input.identifier, password: input.password }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? "invalid_credentials");
    }
    const data = await res.json() as AuthResponse;
    return toSession(data);
  },

  /**
   * Register a new account.
   * Throws an Error whose message is the API error code.
   */
  async register(input: RegisterInput): Promise<Session & { isNewUser?: boolean }> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? "registration_failed");
    }
    const data = await res.json() as AuthResponse;
    return toSession(data);
  },

  /**
   * Validates a session token against the server.
   * Returns null if the token is invalid or expired.
   * Returns the existing (possibly stale) session data if the DB is unavailable (503),
   * to avoid randomly signing users out during outages.
   *
   * Also returns a `dbUnavailable` flag so callers can distinguish a bad token
   * (should clear Zustand) from a DB outage (should preserve Zustand state).
   */
  async validateSession(token: string): Promise<(Session & { dbUnavailable?: boolean }) | null> {
    try {
      const res = await fetch("/api/auth/session", {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.status === 503) {
        // Signal DB outage so Providers can preserve the cached session
        return { token, expiresAt: "", user: null as unknown as User, dbUnavailable: true };
      }
      if (!res.ok) return null;
      const data = await res.json() as { user: User };
      return {
        token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        user: data.user,
      };
    } catch {
      return null;
    }
  },

  /**
   * Fetches the current user from /api/me using only cookies (no Bearer header).
   * Used as a fallback when the Zustand Bearer token is invalid but a valid
   * session cookie (session_token or next-auth.session-token) still exists.
   *
   * Returns null if unauthenticated or DB unavailable.
   * Returns a partial session (no token) if a cookie session is found — caller
   * should then prompt re-login to get a fresh Bearer token into Zustand.
   */
  async fetchMe(): Promise<{ user: User; dbUnavailable?: boolean } | null> {
    try {
      const res = await fetch("/api/me");
      if (res.status === 503) return { user: null as unknown as User, dbUnavailable: true };
      if (!res.ok) return null;
      const data = await res.json() as { user: User };
      return { user: data.user };
    } catch {
      return null;
    }
  },

  /** Signs out — deletes the server session and clears the cookie. */
  async signOut(token?: string): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: token ? { ...authHeaders(), Authorization: `Bearer ${token}` } : authHeaders(),
    }).catch(() => {});
  },

  /** Changes the authenticated user's password.
   *  On success the server rotates the session — the new token is automatically
   *  persisted to the Zustand store so the current device stays logged in.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? "change_failed");
    }
    // Server rotated the session — update the local store with the new token
    const data = await res.json().catch(() => null) as
      | { token: string; expiresAt: string; user: User }
      | null;
    if (data?.token && data?.user) {
      useAuthStore.getState().setSession({
        token: data.token,
        expiresAt: data.expiresAt,
        user: data.user,
      });
    }
  },
};
