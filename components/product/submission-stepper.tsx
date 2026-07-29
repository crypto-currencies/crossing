"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import type { Category } from "@/types";
import { useAuthStore } from "@/store/auth";
import { ProductEmptyState, ProductNotice } from "./product-primitives";

type FormData = {
  name: string;
  websiteUrl: string;
  tagline: string;
  description: string;
  categoryId: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  websiteUrl: "",
  tagline: "",
  description: "",
  categoryId: "",
};

const STEPS = ["Basics", "Details", "Review"] as const;

export function SubmissionStepper() {
  const session = useAuthStore((state) => state.session);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<FormData>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("categories_unavailable");
        return (await response.json()) as { categories?: Category[] };
      })
      .then((payload) => {
        if (cancelled) return;
        setCategories(payload.categories ?? []);
        if (payload.categories?.[0]) {
          setData((current) => ({ ...current, categoryId: current.categoryId || payload.categories![0].id }));
        }
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canContinue = useMemo(() => {
    if (step === 0) return data.name.trim().length >= 2 && /^https?:\/\//i.test(data.websiteUrl);
    if (step === 1) return data.tagline.trim().length >= 4 && data.description.trim().length >= 20 && Boolean(data.categoryId);
    return true;
  }, [data, step]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError("");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) throw new Error("Please log in again before submitting.");
        if (response.status === 429) throw new Error("You have reached the submission limit. Try again later.");
        if (payload.error === "invalid_category") throw new Error("Choose an active category and try again.");
        throw new Error("Crossing could not submit this listing. Check the fields and try again.");
      }
      setStatus("success");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    }
  }

  if (isLoadingAuth) {
    return <div className="catalog-loading" role="status"><LoaderCircle size={20} aria-hidden /> Checking your account…</div>;
  }

  if (!isAuthenticated) {
    return (
      <ProductEmptyState
        title="Log in before you submit"
        body="Submissions are tied to an account so you can track moderation and respond if more information is needed."
        action={{ label: "Log in to continue", href: "/login?redirect=/submit" }}
      />
    );
  }

  if (status === "success") {
    return (
      <section className="submission-success" aria-labelledby="submission-success-title">
        <span aria-hidden><Check size={24} /></span>
        <p className="product-eyebrow">Submission received</p>
        <h2 id="submission-success-title">It is now in the moderation queue</h2>
        <p>
          Crossing confirmed the submission. It will not appear publicly until a moderator reviews the information.
        </p>
        <div>
          <Link href="/submissions">Track submissions</Link>
          <button type="button" onClick={() => { setData(EMPTY_FORM); setStep(0); setStatus("idle"); }}>
            Submit another
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="submission-stepper" onSubmit={submit}>
      <ol className="submission-progress" aria-label="Submission progress">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step}>
            <span>{index < step ? <Check size={13} aria-hidden /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <ProductNotice tone="warning" label="Moderated before publishing">
        <p>
          A submission is a suggestion, not a live listing. Crossing verifies the category and information before approval.
        </p>
      </ProductNotice>

      <div className="submission-panel">
        {step === 0 ? (
          <fieldset>
            <legend>What should Crossing review?</legend>
            <p>Start with the public identity of the listing.</p>
            <label>
              <span>Name</span>
              <input value={data.name} onChange={(event) => update("name", event.target.value)} autoComplete="organization" required minLength={2} maxLength={80} />
            </label>
            <label>
              <span>Website URL</span>
              <input value={data.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} type="url" inputMode="url" placeholder="https://" required />
            </label>
          </fieldset>
        ) : step === 1 ? (
          <fieldset>
            <legend>Help a moderator understand it</legend>
            <p>Use plain language. Avoid promotional claims that cannot be verified.</p>
            <label>
              <span>Category</span>
              <select value={data.categoryId} onChange={(event) => update("categoryId", event.target.value)} required>
                <option value="">Choose a category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              {!categories.length ? <small>No active categories were returned by the catalog.</small> : null}
            </label>
            <label>
              <span>Short description</span>
              <input value={data.tagline} onChange={(event) => update("tagline", event.target.value)} maxLength={140} required />
              <small>{data.tagline.length}/140</small>
            </label>
            <label>
              <span>What it does</span>
              <textarea value={data.description} onChange={(event) => update("description", event.target.value)} minLength={20} maxLength={2000} rows={7} required />
              <small>{data.description.length}/2000</small>
            </label>
          </fieldset>
        ) : (
          <fieldset>
            <legend>Review before sending</legend>
            <p>Nothing is published until the server accepts it and moderation is complete.</p>
            <dl className="submission-review">
              <div><dt>Name</dt><dd>{data.name}</dd></div>
              <div><dt>Website</dt><dd>{data.websiteUrl}</dd></div>
              <div><dt>Category</dt><dd>{categories.find((category) => category.id === data.categoryId)?.name ?? data.categoryId}</dd></div>
              <div><dt>Summary</dt><dd>{data.tagline}</dd></div>
              <div><dt>Description</dt><dd>{data.description}</dd></div>
            </dl>
          </fieldset>
        )}
      </div>

      {error ? <p className="submission-error" role="alert">{error}</p> : null}

      <div className="submission-actions">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || status === "submitting"}>
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="primary" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} disabled={!canContinue}>
            Continue <ArrowRight size={16} aria-hidden />
          </button>
        ) : (
          <button type="submit" className="primary" disabled={status === "submitting" || !canContinue}>
            {status === "submitting" ? <><LoaderCircle className="spin" size={16} aria-hidden /> Submitting…</> : "Send for review"}
          </button>
        )}
      </div>
    </form>
  );
}
