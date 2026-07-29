import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageNotesCopy,
  resultEyebrowCopy,
  resultHeadingCopy,
  resultSummaryCopy,
  searchStateCopy,
} from "@/components/search/search-language";
import type { RankedResult, RankedSearchResponse } from "@/features/search/response";

type SuccessfulSearch = Extract<RankedSearchResponse, { status: "success" }>;

const BANNED_PUBLIC_LANGUAGE =
  /understood as|moderate confidence|high confidence|parsed query|category detected|candidate|semantic match|evidence mode|seeded data|ranking engine|constraint fit/i;

function result(id: string, rank: number): RankedResult {
  return {
    rank,
    entityId: id,
    name: `Option ${rank}`,
    category: "Analytics tools",
    shortReason: "Works for a small team.",
    keyAttributes: [],
    tradeoffs: [],
    sourceSummaries: [],
    evidenceStrength: "limited",
    freshness: { ageDays: 12, label: "Checked recently" },
  };
}

function success(overrides: Partial<SuccessfulSearch> = {}): SuccessfulSearch {
  return {
    status: "success",
    requestId: "request-1",
    timingMs: 10,
    query: {
      rawQuery: "analytics for a small SaaS",
      categoryId: "analytics-tools",
      intent: "recommendation",
      hardConstraints: [],
      softPreferences: [],
      negativePreferences: [],
      requestedResultCount: 3,
      confidence: 0.8,
      ambiguities: [],
    },
    title: "Top analytics tools for small teams",
    results: [result("one", 1), result("two", 2)],
    totalDiscovered: 4,
    totalEvaluated: 4,
    evidenceCoverage: {
      withIndependentReviews: 0,
      withRatings: 0,
      withVerifiedPricing: 0,
      distinctSources: 1,
      gaps: [],
    },
    warnings: [],
    ...overrides,
  };
}

test("result headings and summaries sound like researched recommendations", () => {
  const response = success();
  assert.equal(resultHeadingCopy(response), "Best analytics tools for small teams");
  assert.equal(resultEyebrowCopy(response), "4 options reviewed · 2 included");
  assert.equal(
    resultSummaryCopy(response),
    "2 options selected from 4 options reviewed. Independent reviews weren’t available, so the comparison uses published product information.",
  );
  assert.doesNotMatch(`${resultHeadingCopy(response)} ${resultSummaryCopy(response)}`, BANNED_PUBLIC_LANGUAGE);
});

test("unsupported searches name the unavailable area without exposing a system state", () => {
  const base = {
    status: "unsupported" as const,
    requestId: "request-2",
    timingMs: 4,
    query: success().query,
    title: "Unsupported category",
    message: "Internal response copy",
  };

  assert.deepEqual(searchStateCopy(base, "quiet coffee shop near me"), {
    title: "Local recommendations aren’t available here yet",
    body: "Crossing currently researches software and online tools. Try a software search instead.",
  });
  assert.deepEqual(searchStateCopy(base, "best headphones under $200"), {
    title: "Product recommendations aren’t available here yet",
    body: "Crossing currently researches software and online tools. Try a software search instead.",
  });
});

test("clarification asks a direct human question", () => {
  const response: Extract<RankedSearchResponse, { status: "needs-clarification" }> = {
    status: "needs-clarification",
    requestId: "request-3",
    timingMs: 5,
    query: success().query,
    title: "Needs clarification",
    message: "Choose a category",
    options: [{ id: "analytics-tools", label: "Analytics tools" }],
  };

  assert.deepEqual(searchStateCopy(response, "analytics"), {
    title: "Which kind of analytics are you looking for?",
    body: "Choose the closest match. The rest of your request will stay the same.",
  });

  assert.deepEqual(
    searchStateCopy(
      {
        ...response,
        options: [
          { id: "developer-tools", label: "Developer tools" },
          { id: "analytics-tools", label: "Analytics tools" },
        ],
      },
      "help me choose",
    ),
    {
      title: "Which kind of tool are you looking for?",
      body: "Choose the closest match. The rest of your request will stay the same.",
    },
  );
});

test("uncertainty is attached to missing reviews, pricing, and source coverage", () => {
  const notes = coverageNotesCopy(
    success({
      warnings: [
        "Only 2 options had enough evidence to rank — this isn't a complete picture of the market.",
        "Some sources didn't respond.",
      ],
    }),
  );

  assert.deepEqual(notes, [
    "Independent reviews weren’t available for these options.",
    "Current pricing couldn’t be confirmed for 2 options.",
    "Some sources were unavailable, so this list may not include every relevant option.",
    "Only 2 options had enough published information to include.",
  ]);
  assert.doesNotMatch(notes.join(" "), BANNED_PUBLIC_LANGUAGE);
});
