import type { NotificationSettings } from "@/types";

/**
 * Settings service — thin client-side wrappers over the settings API routes.
 *
 * Note: most settings flows call their API endpoints directly from the
 * components (see components/settings/settings-client.tsx):
 *   - password       → POST  /api/auth/change-password | /api/auth/set-password
 *   - two-factor     → POST  /api/2fa/totp/setup | enable | disable
 *   - deletion       → POST/DELETE /api/account/delete
 * Only notification preferences go through this service.
 */
export const settingsService = {
  async updateNotifications(_userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const res = await fetch("/api/user/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(await res.text());
    const { prefs } = await res.json() as { prefs: NotificationSettings };
    return prefs;
  },
};
