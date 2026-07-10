/**
 * Email sending via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY  — from https://resend.com/api-keys
 *   EMAIL_FROM      — verified sender address (e.g. "noreply@crossing.dev")
 *
 * Both vars must be set. The app will fail loudly at send-time if either is
 * absent so misconfiguration is caught immediately rather than silently dropped.
 */

import { Resend } from "resend";

// ─── Capability check ─────────────────────────────────────────────────────────

/** Returns true when both RESEND_API_KEY and EMAIL_FROM are configured. */
export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// ─── Send helper ──────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via Resend.
 *
 * Throws if:
 *   - RESEND_API_KEY is not set
 *   - EMAIL_FROM is not set
 *   - Resend returns an API-level error
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured — set it in your environment variables."
    );
  }
  if (!from) {
    throw new Error(
      "EMAIL_FROM is not configured — set it in your environment variables."
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html, text });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
