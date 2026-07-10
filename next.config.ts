import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// ─── Content-Security-Policy builder ─────────────────────────────────────────
//
// Rules:
//   • All external origins are listed explicitly — no bare `https:` wildcards.
//   • `*.public.blob.vercel-storage.com` is the one necessary wildcard because
//     the store ID subdomain is assigned by Vercel and unpredictable at deploy
//     time. The `*` in CSP matches exactly one DNS label (not dots), so the
//     scope is strictly limited to first-party Vercel Blob domains.
//   • 'unsafe-inline' is required for both script-src and style-src:
//       - script-src: Next.js injects __NEXT_DATA__ as a plain inline <script>.
//         Nonce-based CSP would require additional Next.js config work.
//       - style-src: Tailwind v4 and Framer Motion emit inline style attributes
//         at runtime; hashing them is not practical.
//   • OAuth token exchanges (Discord, Spotify, Twitch, GitHub, Google) and
//     Upstash Redis calls all run inside Next.js API routes — they are
//     server-to-server and invisible to the browser's CSP engine.
//
// Enforcement switch:
//   Set ENFORCE_CSP=true in your environment to promote the header from
//   Content-Security-Policy-Report-Only to Content-Security-Policy.
//   Default is report-only so violations surface in DevTools before breaking.

function buildCsp(): string {
  // ── Sentry ingest hostname ─────────────────────────────────────────────────
  // Parse the Sentry ingest host from the DSN rather than hardcoding it.
  // DSN format: https://<publicKey>@<host>/<projectId>
  let sentryIngestHost = "";
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
  if (dsn) {
    try {
      // Strip the key@ prefix so URL() can parse the host cleanly.
      sentryIngestHost = new URL(dsn.replace(/\/\/[^@]+@/, "//")).hostname;
    } catch {
      // Malformed DSN — skip; Sentry will fail to init anyway.
    }
  }

  // ── Vercel preview toolbar ─────────────────────────────────────────────────
  // Vercel injects a floating toolbar into preview deployments. It loads
  // scripts/styles from vercel.live, renders a frame, and uses Pusher
  // WebSockets for live-reload. None of these are needed in production.
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  const directives: string[] = [
    // ── Fallback ─────────────────────────────────────────────────────────────
    "default-src 'self'",

    // ── Scripts ──────────────────────────────────────────────────────────────
    // 'unsafe-inline' — required for Next.js __NEXT_DATA__ inline bootstrap.
    // 'unsafe-eval'   — required in development only; React uses eval() for
    //                   error overlay source-map reconstruction and HMR.
    //                   React never calls eval() in production.
    [
      "script-src 'self' 'unsafe-inline'",
      process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "",
      // Vercel preview toolbar script bundle.
      isVercelPreview ? "https://vercel.live" : "",
    ].filter(Boolean).join(" "),

    // ── Styles ───────────────────────────────────────────────────────────────
    // 'unsafe-inline' — required for Tailwind v4 + Framer Motion inline styles.
    [
      "style-src 'self' 'unsafe-inline'",
      // Vercel preview toolbar stylesheet.
      isVercelPreview ? "https://vercel.live" : "",
    ].filter(Boolean).join(" "),

    // ── Images ───────────────────────────────────────────────────────────────
    [
      "img-src 'self' data: blob:",
      // User-uploaded avatars stored in Vercel Blob. The `*` matches only the
      // store-ID subdomain label — e.g. abc123.public.blob.vercel-storage.com.
      "*.public.blob.vercel-storage.com",
      // Google OAuth profile photos.
      "lh3.googleusercontent.com",
      // Vercel preview toolbar UI assets.
      isVercelPreview ? "https://vercel.live https://vercel.com" : "",
    ].filter(Boolean).join(" "),

    // ── Fetch / XHR / WebSocket ───────────────────────────────────────────────
    // Third-party API calls (OAuth, Upstash, Resend) are server-to-server.
    // Vercel Blob client upload flow (two separate hosts):
    //   1. @vercel/blob/client put() calls https://vercel.com/api/blob/ to
    //      obtain a presigned upload URL (bearer-authed with the client token).
    //   2. The browser then uploads the file body directly to the presigned URL
    //      at *.blob.vercel-storage.com, bypassing the 4.5 MB function limit.
    // Both hosts must be in connect-src or the upload silently fails.
    [
      "connect-src 'self'",
      // Vercel Blob API — client token exchange / upload orchestration.
      "https://vercel.com",
      // Vercel Blob CDN — actual file upload destination (single + multipart).
      "https://*.blob.vercel-storage.com",
      // Sentry client-side SDK POSTs error events directly to the ingest
      // endpoint from the browser. The host is parsed from the DSN above.
      sentryIngestHost ? `https://${sentryIngestHost}` : "",
      // Vercel preview toolbar uses Pusher WebSockets for live reload.
      isVercelPreview
        ? "https://vercel.live wss://ws-us3.pusher.com https://sockjs-us3.pusher.com"
        : "",
    ].filter(Boolean).join(" "),

    // ── Media (audio / video) ─────────────────────────────────────────────────
    [
      "media-src 'self' blob:",
      // User-uploaded video backgrounds, GIF banners, and future audio files.
      "*.public.blob.vercel-storage.com",
    ].filter(Boolean).join(" "),

    // ── Frames ───────────────────────────────────────────────────────────────
    // No iframes are rendered today.
    [
      "frame-src",
      // Vercel preview toolbar frame.
      isVercelPreview ? "https://vercel.live" : "",
    ].filter(Boolean).join(" "),

    // ── Fonts ─────────────────────────────────────────────────────────────────
    // All fonts are self-hosted. No Google Fonts or external font CDNs used.
    "font-src 'self' data:",

    // ── Workers ──────────────────────────────────────────────────────────────
    // blob: covers inline Web Workers created by Next.js / Framer Motion.
    "worker-src 'self' blob:",

    // ── Misc hardening ────────────────────────────────────────────────────────
    // Blocks Flash, PDF plugins, and other legacy plugin content.
    "object-src 'none'",
    // Prevents <base> tag injection from hijacking relative URLs.
    "base-uri 'self'",
    // Restricts where forms can POST — only to this origin.
    "form-action 'self'",
    // Prevents this page from being loaded inside any iframe (clickjacking).
    "frame-ancestors 'none'",
  ];

  return directives.join("; ");
}

// ── Enforcement switch ────────────────────────────────────────────────────────
// Production default: Content-Security-Policy (enforced — blocks violations).
// Set CSP_REPORT_ONLY=true to demote to report-only (log-only, no blocking).
// In development: always report-only to avoid breaking HMR / eval.
const cspHeaderName =
  process.env.NODE_ENV !== "production" || process.env.CSP_REPORT_ONLY === "true"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

// ─── Next.js config ───────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@vercel/blob"],

  experimental: {
    // framer-motion exports hundreds of named symbols; tree-shake to only what's used.
    // (lucide-react is already in the default list so not repeated here.)
    optimizePackageImports: ["framer-motion"],
  },

  images: {
    remotePatterns: [
      // ── User-uploaded content (Vercel Blob) ─────────────────────────────────
      // Blob URLs look like: https://<storeId>.public.blob.vercel-storage.com/…
      // The wildcard (*) matches exactly one DNS label, which is the store ID.
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      // ── OAuth provider avatars ───────────────────────────────────────────────
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  async headers() {
    const csp = buildCsp();

    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the site from being framed (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit Referer header leakage on cross-origin navigations
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict access to sensitive device APIs
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS — only applied by browsers on HTTPS; ignored on HTTP
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP — report-only by default; set ENFORCE_CSP=true to enforce.
          { key: cspHeaderName, value: csp },
        ],
      },
    ];
  },
};

// ─── Sentry build options ─────────────────────────────────────────────────────

const sentryUploadEnabled =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print upload logs in CI
  silent: !process.env.CI,

  // Skip source map upload when auth/org/project env vars are absent
  sourcemaps: {
    disable: !sentryUploadEnabled,
  },

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: sentryUploadEnabled,

  webpack: {
    // Automatic instrumentation of Vercel Cron Monitors
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
};

// Skip the Sentry wrapper in development — it adds significant build-time overhead
// (webpack instrumentation, OpenTelemetry patching) that tanks dev server CPU usage.
// Sentry.init() is also gated in instrumentation.ts / instrumentation-client.ts.
export default process.env.NODE_ENV === "production"
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
