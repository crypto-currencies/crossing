export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function now(): string {
  return new Date().toISOString();
}

/** Returns auth headers using the stored session token, if any. */
export function authHeaders(): Record<string, string> {
  try {
    // Dynamic import avoids circular deps at module load; this runs client-side only
    const stored = localStorage.getItem("exclude-auth");
    if (!stored) return {};
    const parsed = JSON.parse(stored) as { state?: { session?: { token?: string } } };
    const token = parsed?.state?.session?.token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

/** Fetches a JSON API endpoint. Returns null on any error. */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    // Destructure headers so we can merge them safely — spreading `...options`
    // after a `headers` key would silently overwrite our auth headers if the
    // caller passes their own options.headers object.
    const { headers: optHeaders, ...restOpts } = options ?? {};
    const res = await fetch(path, {
      ...restOpts,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(optHeaders as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        res.clone().text()
          .then((t) => console.warn(`[apiFetch] ${res.status} ${path}:`, t.slice(0, 300)))
          .catch(() => {});
      }
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[apiFetch] network error ${path}:`, err);
    }
    return null;
  }
}

/** POST helper that returns null on error. */
export async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/** PATCH helper that returns null on error. */
export async function apiPatch<T>(path: string, body: unknown): Promise<T | null> {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

/** DELETE helper. */
export async function apiDelete(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "DELETE", headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}
