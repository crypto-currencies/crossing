import { authHeaders } from "./utils";

export interface SubmissionCreateInput {
  name: string;
  websiteUrl: string;
  tagline: string;
  description: string;
  categoryId: string;
}

export interface SubmissionCreateSuccess {
  ok: true;
  submissionId: string;
}

/**
 * Thrown by `create()` — message is the API error code
 * (invalid_category | duplicate_pending | duplicate_listing | invalid_body |
 * rate_limited | unauthorized | db_unavailable) so the submit form can show
 * a specific, actionable message rather than a generic failure.
 */
export class SubmissionError extends Error {
  fieldErrors?: Record<string, string[]>;
  constructor(code: string, fieldErrors?: Record<string, string[]>) {
    super(code);
    this.name = "SubmissionError";
    this.fieldErrors = fieldErrors;
  }
}

export const submissionsService = {
  async create(input: SubmissionCreateInput): Promise<SubmissionCreateSuccess> {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });

    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      submissionId?: string;
      error?: string;
      issues?: Record<string, string[]>;
    };

    if (!res.ok) {
      throw new SubmissionError(data.error ?? "submission_failed", data.issues);
    }

    return { ok: true, submissionId: data.submissionId! };
  },
};
