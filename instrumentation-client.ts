import * as Sentry from "@sentry/nextjs";

// Skip in development — replayIntegration() is a continuous DOM screen recorder,
// and 100% trace sampling creates severe CPU overhead on the dev machine.
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: 0.2,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
