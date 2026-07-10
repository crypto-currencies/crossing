import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast in production when required env vars are missing;
    // warn-only in development.
    const { validateEnv } = await import("./lib/server/env-validation");
    validateEnv();

    // Skip Sentry server init in development — 100% trace sampling adds
    // measurable overhead on every API route invocation.
    if (process.env.NODE_ENV === "production") {
      await import("./sentry.server.config");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.NODE_ENV === "production") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
