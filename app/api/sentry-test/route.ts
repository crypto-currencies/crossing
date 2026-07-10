import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// ─── GET /api/sentry-test ─────────────────────────────────────────────────────
// Throws a test exception so you can verify Sentry is receiving events.
// Remove this file after you've confirmed events appear in your Sentry project.
//
// Usage: curl https://your-domain/api/sentry-test
// Expected: 500 JSON response + one new error in Sentry within ~30s.
//
// Disabled in production unless SENTRY_TEST_SECRET is set and passed as a
// query param (?secret=...) to prevent accidental noise in prod dashboards.

export async function GET(request: Request) {
  const secret = process.env.SENTRY_TEST_SECRET;

  if (process.env.NODE_ENV === "production" && secret) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const err = new Error(
    "Sentry test error — safe to ignore, triggered from /api/sentry-test"
  );

  Sentry.captureException(err, {
    tags: { test: "true", source: "sentry-test-route" },
  });

  await Sentry.flush(2000);

  throw err;
}
