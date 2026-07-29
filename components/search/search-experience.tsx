"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { EXAMPLE_QUERIES } from "@/features/recommendation/view-model";
import type { FeedbackKind } from "@/features/recommendation/feedback";
import type {
  CategoryOption,
  RankedResult,
  RankedSearchResponse,
} from "@/features/search/response";
import { useAuthStore } from "@/store/auth";
import { RankedResultList } from "./ranked-result-list";
import { ResultComparison } from "./result-comparison";
import { SearchEmptyState } from "./search-empty-state";
import { SearchProgress } from "./search-progress";
import {
  SearchRefinementBar,
  type ActivePreference,
} from "./search-refinement-bar";
import {
  coverageNotesCopy,
  liveSearchStatusCopy,
  requestErrorCopy,
  resultEyebrowCopy,
  resultHeadingCopy,
  resultSummaryCopy,
  searchStateCopy,
  SEARCH_LANGUAGE,
  type SaveState,
} from "./search-language";
import styles from "./search-results.module.css";

type Status = "idle" | "loading" | "loading-more" | "error" | "done";
type View = "idle" | "loading" | "error" | "no-results" | "unsupported" | "needs-category" | "results";

export function SearchExperience({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<RankedSearchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [compareIds, setCompareIds] = useState<Set<string>>(() => new Set());
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (raw: string, options?: { categoryId?: string }) => {
    const q = raw.trim();
    if (!q) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setErrorMsg("");
    setLoadMoreError("");
    setFeedbackSent(false);
    setExpandedIds(new Set());
    setCompareIds(new Set());
    setSaveStates({});

    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    window.history.replaceState(null, "", url.toString());

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: q,
          contract: "ranked",
          limit: 12,
          ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as RankedSearchResponse | { error?: string } | null;
      if (data && "status" in data) {
        setResponse(data);
        setStatus("done");
        return;
      }

      setErrorMsg(requestErrorCopy(res.status, data?.error));
      setResponse(null);
      setStatus("error");
    } catch {
      if (controller.signal.aborted) return;
      setErrorMsg(requestErrorCopy(0));
      setResponse(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const q = initialQuery.trim();
    if (!q) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runSearch(q);
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [initialQuery, runSearch]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query);
  }

  function onExample(nextQuery: string) {
    setQuery(nextQuery);
    void runSearch(nextQuery);
    inputRef.current?.focus();
  }

  function focusSearch() {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }

  async function loadMore() {
    if (response?.status !== "success" || !response.nextCursor || status === "loading-more") return;
    setStatus("loading-more");
    setLoadMoreError("");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: response.query.rawQuery,
          contract: "ranked",
          limit: 12,
          cursor: response.nextCursor,
        }),
      });
      const next = (await res.json().catch(() => null)) as RankedSearchResponse | null;
      if (!res.ok || next?.status !== "success") throw new Error("more_results_unavailable");

      setResponse((current) => {
        if (current?.status !== "success") return next;
        const seen = new Set(current.results.map((item) => item.entityId));
        const additional = next.results.filter((item) => !seen.has(item.entityId));
        return {
          ...next,
          title: current.title,
          summary: current.summary,
          results: [...current.results, ...additional],
        };
      });
      setStatus("done");
    } catch {
      setLoadMoreError("More options aren’t available right now. Try again.");
      setStatus("done");
    }
  }

  async function saveResult(item: RankedResult) {
    if (!isAuthenticated) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    if (saveStates[item.entityId] === "saving" || saveStates[item.entityId] === "saved") return;

    setSaveStates((current) => ({ ...current, [item.entityId]: "saving" }));
    try {
      const result = await fetch("/api/saved", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ entityKey: item.entityId, sourceQuery: query }),
      });
      const body = (await result.json().catch(() => null)) as { ok?: boolean } | null;
      if (!result.ok || body?.ok !== true) throw new Error("save_not_confirmed");
      setSaveStates((current) => ({ ...current, [item.entityId]: "saved" }));
    } catch {
      setSaveStates((current) => ({ ...current, [item.entityId]: "error" }));
    }
  }

  async function sendFeedback(kind: FeedbackKind) {
    if (!response) return;
    setFeedbackSent(true);
    try {
      await fetch("/api/recommend/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: response.requestId,
          kind,
          entityId: response.status === "success" ? response.results[0]?.entityId : undefined,
        }),
      });
    } catch {
      // Feedback is deliberately best-effort and never blocks the results.
    }
  }

  const view = deriveView(status, response);
  const successfulResponse = response?.status === "success" ? response : null;
  const items = successfulResponse?.results ?? [];
  const preferences = successfulResponse ? activePreferences(successfulResponse) : [];
  const comparedItems = items.filter((item) => compareIds.has(item.entityId));
  const coverageNotes = successfulResponse ? coverageNotesCopy(successfulResponse) : [];
  const stateResponse = response?.status === "success" ? null : response;
  const stateCopy = searchStateCopy(stateResponse, query);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.eyebrow}>{SEARCH_LANGUAGE.search.eyebrow}</span>
            <p>{SEARCH_LANGUAGE.search.introduction}</p>
          </div>
          <Link href="/">{SEARCH_LANGUAGE.search.newSearch}</Link>
        </header>

        <form className={styles.searchForm} onSubmit={onSubmit} role="search">
          <label htmlFor="crossing-query" className={styles.visuallyHidden}>
            {SEARCH_LANGUAGE.search.inputLabel}
          </label>
          <Search size={21} aria-hidden />
          <input
            id="crossing-query"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="best privacy-friendly analytics for a small SaaS"
            maxLength={300}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? SEARCH_LANGUAGE.search.submitting : SEARCH_LANGUAGE.search.submit}
            <ArrowRight size={17} aria-hidden />
          </button>
        </form>

        <p className={styles.visuallyHidden} role="status" aria-live="polite">
          {liveSearchStatusCopy(view, items)}
        </p>

        <main className={styles.resultsArea} aria-busy={status === "loading" || status === "loading-more"}>
          {view === "loading" ? <SearchProgress /> : null}

          {view === "error" ? (
            <SearchEmptyState
              tone={response?.status === "error" && response.code === "search_unavailable" ? "provider" : "error"}
              title={
                stateCopy.title
              }
              body={response?.status === "error" ? stateCopy.body : errorMsg || stateCopy.body}
            >
              <button type="button" className={styles.statePrimaryAction} onClick={() => runSearch(query)}>
                Try again
              </button>
            </SearchEmptyState>
          ) : null}

          {view === "no-results" && response?.status === "no-results" ? (
            <SearchEmptyState tone="empty" title={stateCopy.title} body={stateCopy.body}>
              <button type="button" className={styles.statePrimaryAction} onClick={focusSearch}>
                {SEARCH_LANGUAGE.search.refine}
              </button>
              <ExampleSearches onExample={onExample} />
            </SearchEmptyState>
          ) : null}

          {view === "unsupported" && response?.status === "unsupported" ? (
            <SearchEmptyState tone="unsupported" title={stateCopy.title} body={stateCopy.body}>
              <ExampleSearches onExample={onExample} />
            </SearchEmptyState>
          ) : null}

          {view === "needs-category" && response?.status === "needs-clarification" ? (
            <SearchEmptyState tone="clarify" title={stateCopy.title} body={stateCopy.body}>
              <CategoryChoices
                suggestions={response.options}
                onPick={(categoryId) => runSearch(query, { categoryId })}
              />
            </SearchEmptyState>
          ) : null}

          {successfulResponse ? (
            <>
              <section className={styles.answerHeading} aria-labelledby="answer-heading">
                <span>
                  {resultEyebrowCopy(successfulResponse)}
                </span>
                <h1 id="answer-heading">{resultHeadingCopy(successfulResponse)}</h1>
                <p>{resultSummaryCopy(successfulResponse)}</p>
              </section>

              <SearchRefinementBar
                categoryName={items[0]?.category ?? "Results"}
                preferences={preferences}
                compareCount={compareIds.size}
                onRefine={focusSearch}
              />

              {coverageNotes.length > 0 ? (
                <div className={styles.evidenceNotice} role="note">
                  <TriangleAlert size={17} aria-hidden />
                  <div>
                    <strong>A few details need a closer look</strong>
                    <ul>
                      {coverageNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                </div>
              ) : null}

              <RankedResultList
                items={items}
                expandedIds={expandedIds}
                compareIds={compareIds}
                isAuthenticated={isAuthenticated}
                saveStates={saveStates}
                onToggleExpanded={toggleExpanded}
                onToggleCompare={toggleCompare}
                onSave={saveResult}
              />

              {successfulResponse.nextCursor ? (
                <div className={styles.loadMore}>
                  <button type="button" onClick={loadMore} disabled={status === "loading-more"}>
                    {status === "loading-more" ? (
                      <>
                        <LoaderCircle className={styles.spinner} size={16} aria-hidden />
                        {SEARCH_LANGUAGE.results.loadingMore}
                      </>
                    ) : (
                      <>
                        {SEARCH_LANGUAGE.results.showMore}
                        <ArrowRight size={15} aria-hidden />
                      </>
                    )}
                  </button>
                  {loadMoreError ? <p role="status">{loadMoreError}</p> : null}
                </div>
              ) : null}

              <ResultComparison items={comparedItems} onRemove={toggleCompare} />

              <section className={styles.relatedSearches} aria-labelledby="related-searches-title">
                <div>
                  <span>Keep exploring</span>
                  <h2 id="related-searches-title">Try another search</h2>
                </div>
                <div>
                  {EXAMPLE_QUERIES.slice(0, 4).map((example) => (
                    <button type="button" key={example} onClick={() => onExample(example)}>
                      {example}
                      <ArrowRight size={14} aria-hidden />
                    </button>
                  ))}
                </div>
              </section>

              <FeedbackBar sent={feedbackSent} onFeedback={sendFeedback} />
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function deriveView(status: Status, response: RankedSearchResponse | null): View {
  if (status === "idle") return "idle";
  if (status === "loading") return "loading";
  if (status === "error" || !response) return "error";
  if (response.status === "success") return "results";
  if (response.status === "no-results") return "no-results";
  if (response.status === "unsupported") return "unsupported";
  if (response.status === "needs-clarification") return "needs-category";
  return "error";
}

function activePreferences(response: Extract<RankedSearchResponse, { status: "success" }>): ActivePreference[] {
  const parsed = response.query;
  return [
    ...parsed.hardConstraints.map((preference, index) => ({
      id: `hard:${index}`,
      label: preference.label,
    })),
    ...parsed.softPreferences.map((preference, index) => ({
      id: `soft:${index}`,
      label: preference.label.replace(/^Prefers\s+/i, ""),
    })),
    ...parsed.negativePreferences.map((preference, index) => ({
      id: `negative:${index}`,
      label: preference.label,
    })),
  ].slice(0, 8);
}

function ExampleSearches({ onExample }: { onExample: (query: string) => void }) {
  return (
    <div className={styles.exampleActions}>
      {EXAMPLE_QUERIES.slice(0, 3).map((example) => (
        <button type="button" key={example} onClick={() => onExample(example)}>
          {example}
        </button>
      ))}
    </div>
  );
}

function CategoryChoices({
  suggestions,
  onPick,
}: {
  suggestions: CategoryOption[];
  onPick: (categoryId: string) => void;
}) {
  return (
    <div className={styles.categoryChoices} role="group" aria-label="Choose a category">
      {suggestions.map((suggestion) => (
        <button type="button" key={suggestion.id} onClick={() => onPick(suggestion.id)}>
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

function FeedbackBar({
  sent,
  onFeedback,
}: {
  sent: boolean;
  onFeedback: (kind: FeedbackKind) => void;
}) {
  if (sent) {
    return (
      <p className={styles.feedbackThanks}>
        <CheckCircle2 size={16} aria-hidden />
        Thanks. Your feedback was received.
      </p>
    );
  }

  return (
    <div className={styles.feedbackBar} role="group" aria-label="Did these options help?">
      <span>Did these options help?</span>
      <button type="button" onClick={() => onFeedback("helpful")}>
        <ThumbsUp size={14} aria-hidden />
        Yes
      </button>
      <button type="button" onClick={() => onFeedback("not_helpful")}>
        <ThumbsDown size={14} aria-hidden />
        Not quite
      </button>
      <button type="button" onClick={() => onFeedback("missed_option")}>
        It missed an option
      </button>
    </div>
  );
}
