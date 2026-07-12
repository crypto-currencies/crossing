"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submissionsService, SubmissionError } from "@/lib/services/submissions.service";
import type { CategorySummary } from "@/types";

interface SubmitFormProps {
  categories: CategorySummary[];
}

interface FormState {
  name: string;
  websiteUrl: string;
  categoryId: string;
  tagline: string;
  description: string;
}

const EMPTY: FormState = { name: "", websiteUrl: "", categoryId: "", tagline: "", description: "" };

const LIMITS = {
  name: { min: 2, max: 80 },
  tagline: { min: 4, max: 140 },
  description: { min: 20, max: 2000 },
} as const;

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (form.name.trim().length < LIMITS.name.min) errors.name = `At least ${LIMITS.name.min} characters.`;
  else if (form.name.length > LIMITS.name.max) errors.name = `Keep it under ${LIMITS.name.max} characters.`;

  if (!form.websiteUrl.trim()) errors.websiteUrl = "A website URL is required.";
  else {
    try {
      const url = new URL(form.websiteUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") errors.websiteUrl = "Must be a http(s) URL.";
    } catch {
      errors.websiteUrl = "Enter a full URL, e.g. https://example.com";
    }
  }

  if (!form.categoryId) errors.categoryId = "Pick a category.";

  if (form.tagline.trim().length < LIMITS.tagline.min) errors.tagline = `At least ${LIMITS.tagline.min} characters.`;
  else if (form.tagline.length > LIMITS.tagline.max) errors.tagline = `Keep it under ${LIMITS.tagline.max} characters.`;

  if (form.description.trim().length < LIMITS.description.min)
    errors.description = `At least ${LIMITS.description.min} characters — give it some real detail.`;
  else if (form.description.length > LIMITS.description.max)
    errors.description = `Keep it under ${LIMITS.description.max} characters.`;

  return errors;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_category: "That category isn't valid — pick one from the list.",
  duplicate_pending: "You've already submitted this site and it's still pending review.",
  duplicate_listing: "This site is already listed on Crossing.dev.",
  invalid_body: "Some fields need fixing before this can be submitted.",
  rate_limited: "You've submitted a few things recently — try again in a bit.",
  unauthorized: "Your session expired — sign in again.",
  db_unavailable: "Submissions are temporarily unavailable. Try again shortly.",
};

export function SubmitForm({ categories }: SubmitFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      await submissionsService.create({
        name: form.name.trim(),
        websiteUrl: form.websiteUrl.trim(),
        categoryId: form.categoryId,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
      });
      setSuccess(true);
    } catch (err) {
      const code = err instanceof SubmissionError ? err.message : "submission_failed";
      setSubmitError(ERROR_MESSAGES[code] ?? "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="page-stack">
        <SectionShell spacing="default" className="pb-[80px]">
          <div className="mx-auto flex max-w-[480px] flex-col items-center gap-[16px] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] px-[28px] py-[56px] text-center">
            <div className="flex size-[48px] items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)]">
              <CheckCircle2 className="size-[22px] text-[var(--accent-text)]" />
            </div>
            <div className="stack-xs">
              <p className="t-heading">Thanks — it&rsquo;s in the queue</p>
              <p className="t-body-sm text-[var(--text-soft)]">
                A moderator will review your submission before it goes live. You&rsquo;ll get a
                notification either way, and you can track its status anytime.
              </p>
            </div>
            <div className="mt-[6px] flex gap-[10px]">
              <Button variant="secondary" size="md" onClick={() => { setForm(EMPTY); setSuccess(false); }}>
                Submit another
              </Button>
              <Button variant="primary" size="md" asChild>
                <Link href="/submissions">View your submissions</Link>
              </Button>
            </div>
          </div>
        </SectionShell>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <SectionShell spacing="tight">
        <PageHeader
          title="Submit a listing"
          description="Tell us about something worth discovering. A moderator reviews every submission before it goes live."
        />
      </SectionShell>

      <SectionShell spacing="default" className="pb-[80px]">
        <form onSubmit={handleSubmit} className="max-w-[560px] stack-lg" noValidate>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Linear"
            error={errors.name}
            maxLength={LIMITS.name.max}
            required
          />

          <Input
            label="Website URL"
            type="url"
            value={form.websiteUrl}
            onChange={(e) => update("websiteUrl", e.target.value)}
            placeholder="https://example.com"
            error={errors.websiteUrl}
            required
          />

          <div className="flex flex-col gap-[8px]">
            <label htmlFor="submit-category" className="t-label text-[var(--text-soft)]">
              Category
            </label>
            <select
              id="submit-category"
              value={form.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
              className="input h-10 px-[12px] text-[13px] text-[var(--text)]"
              required
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="t-caption text-[var(--danger)]">{errors.categoryId}</p>}
          </div>

          <Input
            label="Tagline"
            value={form.tagline}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="One sentence — what does it do?"
            error={errors.tagline}
            hint={!errors.tagline ? `${form.tagline.length}/${LIMITS.tagline.max}` : undefined}
            maxLength={LIMITS.tagline.max}
            required
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="What is it, who's it for, and why does it belong here?"
            error={errors.description}
            hint={!errors.description ? `${form.description.length}/${LIMITS.description.max}` : undefined}
            maxLength={LIMITS.description.max}
            rows={5}
            required
          />

          {submitError && (
            <div className="flex items-start gap-[8px] rounded-[var(--radius-md)] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-[12px] py-[10px] text-[12.5px] text-[var(--danger)]">
              <AlertTriangle className="mt-[1px] size-[13px] flex-shrink-0" />
              {submitError}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="self-start">
            Submit for review
          </Button>
        </form>
      </SectionShell>
    </div>
  );
}
