import type {
  RankedResult,
  RankedSearchResponse,
  SourceSummary,
} from "@/features/search/response";

type SuccessfulSearch = Extract<RankedSearchResponse, { status: "success" }>;
type SearchStateResponse = Exclude<RankedSearchResponse, { status: "success" }>;

export type SaveState = "idle" | "saving" | "saved" | "error";
export type SearchArea = "local" | "product" | "software" | "other";

export const SEARCH_LANGUAGE = {
  search: {
    eyebrow: "Search Crossing",
    introduction: "Describe what you need. We’ll do the comparing.",
    newSearch: "Start over",
    inputLabel: "What are you looking for?",
    submit: "Search again",
    submitting: "Searching…",
    refine: "Adjust your search",
  },
  results: {
    listHeading: "Best matches",
    topPick: "Top pick",
    bestFor: "Best for",
    bestForFallback: "A balanced choice",
    tradeoff: "Keep in mind",
    noTradeoff: "No tradeoff was noted in the available sources",
    showMore: "Show more options",
    loadingMore: "Finding more options…",
  },
  reviews: {
    heading: "What reviewers say",
    missing: "Independent reviews not available",
    noDate: "Review dates were not available.",
    disagreement: "Independent sources disagree, so the overall rating may not tell the whole story.",
  },
  sources: {
    heading: "Sources",
    introduction: "Product pages, independent reviews, and editorial coverage are labeled separately.",
    missing: "No source links were included for this option.",
    official: "Official product page",
    independent: "Independent reviews",
    editorial: "Editorial coverage",
    officialFact: "Product information",
    independentFact: "Independent source",
    editorialFact: "Editorial source",
  },
  pricing: {
    heading: "Pricing",
    missing: "Pricing not available",
    verified: "Pricing confirmed from a linked source.",
    unverified: "Current pricing could not be confirmed.",
  },
  save: {
    idle: "Save",
    saving: "Saving…",
    saved: "Saved",
    signedOut: "Log in to save",
    error: "Couldn’t save this yet. Try again.",
  },
  loading: {
    heading: "Finding the strongest options",
    introduction: "We’re checking the details that matter for this search.",
    steps: [
      "Finding current options",
      "Checking product details and pricing",
      "Reading independent reviews",
    ],
  },
  comparison: {
    heading: "Compare your shortlist",
    introduction: "Only details available from the linked sources are shown.",
  },
} as const;

export function resultHeadingCopy(response: SuccessfulSearch): string {
  return response.title.replace(/^Top\b/i, "Best");
}

export function resultEyebrowCopy(response: SuccessfulSearch): string {
  return `${response.totalEvaluated} ${plural(response.totalEvaluated, "option")} reviewed · ${response.results.length} included`;
}

export function resultSummaryCopy(response: SuccessfulSearch): string {
  const shown = response.results.length;
  const researched = response.totalEvaluated;
  const reviewCount = response.evidenceCoverage.withIndependentReviews;
  const lead = `${shown} ${plural(shown, "option")} selected from ${researched} ${plural(researched, "option")} reviewed.`;

  if (reviewCount === 0) {
    return `${lead} Independent reviews weren’t available, so the comparison uses published product information.`;
  }
  if (reviewCount < shown) {
    return `${lead} Independent reviews are available for ${reviewCount} of them.`;
  }
  return `${lead} Each one includes independent review information.`;
}

export function resultListSummaryCopy(count: number): string {
  return `${count} ${plural(count, "option")} · Closest matches first`;
}

export function liveSearchStatusCopy(
  view: "idle" | "loading" | "error" | "no-results" | "unsupported" | "needs-category" | "results",
  items: RankedResult[],
): string {
  if (view === "loading") return "Looking for current options and checking the details.";
  if (view === "results") {
    return `Found ${items.length} ${plural(items.length, "option")}. ${items[0]?.name ?? "The first option"} is the closest match.`;
  }
  if (view === "error") return "That search didn’t finish.";
  if (view === "unsupported") return "That kind of recommendation isn’t available here yet.";
  if (view === "needs-category") return "Choose the kind of option you want.";
  if (view === "no-results") return "No options matched everything in this search.";
  return "";
}

export function searchStateCopy(
  response: SearchStateResponse | null,
  query: string,
): { title: string; body: string } {
  if (!response || response.status === "error") {
    if (response?.status === "error" && response.code === "search_unavailable") {
      return {
        title: "Search is temporarily unavailable",
        body: "Crossing can’t reach its sources right now. Try again in a moment.",
      };
    }
    if (response?.status === "error" && response.code === "deadline_exceeded") {
      return {
        title: "This search is taking longer than expected",
        body: "Try it again, or make the request a little more specific.",
      };
    }
    return {
      title: "That search didn’t finish",
      body: "Try again. If it keeps happening, change the wording or remove one requirement.",
    };
  }

  if (response.status === "needs-clarification") {
    return {
      title: clarificationTitle(response.options.map((option) => option.label), query),
      body: "Choose the closest match. The rest of your request will stay the same.",
    };
  }

  if (response.status === "unsupported") {
    const area = searchArea(query);
    if (area === "local") {
      return {
        title: "Local recommendations aren’t available here yet",
        body: "Crossing currently researches software and online tools. Try a software search instead.",
      };
    }
    if (area === "product") {
      return {
        title: "Product recommendations aren’t available here yet",
        body: "Crossing currently researches software and online tools. Try a software search instead.",
      };
    }
    return {
      title: "That kind of recommendation isn’t available here yet",
      body: "Crossing currently researches software and online tools.",
    };
  }

  if (response.totalEvaluated > 0) {
    return {
      title: "No options matched everything you asked for",
      body: "Try changing one requirement, widening the budget, or describing what matters most.",
    };
  }
  return {
    title: "We don’t have enough information for that search yet",
    body: "Try a broader description or choose one of the searches below.",
  };
}

export function coverageNotesCopy(response: SuccessfulSearch): string[] {
  const notes: string[] = [];
  const shown = response.results.length;
  const independent = response.evidenceCoverage.withIndependentReviews;
  const verifiedPricing = response.evidenceCoverage.withVerifiedPricing;

  if (independent === 0) {
    notes.push("Independent reviews weren’t available for these options.");
  } else if (independent < shown) {
    notes.push(`Independent reviews weren’t available for ${shown - independent} ${plural(shown - independent, "option")}.`);
  }

  if (independent > 0 && response.evidenceCoverage.withRatings < shown) {
    const withoutRatings = shown - response.evidenceCoverage.withRatings;
    notes.push(`${withoutRatings} ${plural(withoutRatings, "option")} ${withoutRatings === 1 ? "doesn’t" : "don’t"} have an independent overall rating.`);
  }

  if (verifiedPricing < shown) {
    notes.push(`Current pricing couldn’t be confirmed for ${shown - verifiedPricing} ${plural(shown - verifiedPricing, "option")}.`);
  }

  if (response.warnings.some((warning) => /source|provider|respond/i.test(warning))) {
    notes.push("Some sources were unavailable, so this list may not include every relevant option.");
  }

  if (response.warnings.some((warning) => /complete picture|enough evidence|enough information/i.test(warning))) {
    notes.push(`Only ${shown} ${plural(shown, "option")} had enough published information to include.`);
  }

  if (response.results.some((item) => item.freshness.ageDays != null && item.freshness.ageDays > 120)) {
    notes.push("Some information may be out of date. Open an option to see when its sources were checked.");
  }

  return [...new Set(notes)];
}

export function sourceCoverageLabel(item: RankedResult): string {
  switch (item.evidenceStrength) {
    case "strong":
      return "Backed by multiple independent sources";
    case "moderate":
      return "Independent information is available";
    case "limited":
    default:
      return "Few independent reviews available";
  }
}

export function sourceKindLabel(kind: SourceSummary["kind"]): string {
  if (kind === "official") return SEARCH_LANGUAGE.sources.official;
  if (kind === "editorial") return SEARCH_LANGUAGE.sources.editorial;
  return SEARCH_LANGUAGE.sources.independent;
}

export function sourceFactLabel(kind: SourceSummary["kind"]): string {
  if (kind === "official") return SEARCH_LANGUAGE.sources.officialFact;
  if (kind === "editorial") return SEARCH_LANGUAGE.sources.editorialFact;
  return SEARCH_LANGUAGE.sources.independentFact;
}

export function informationFreshnessCopy(item: RankedResult): string {
  const age = item.freshness.ageDays;
  if (age == null) return "Update date unavailable";
  if (age < 14) return "Sources checked within two weeks";
  if (age < 45) return "Sources checked within six weeks";
  if (age < 120) return "Sources checked within four months";
  return "Some information may be out of date";
}

export function pricingVerificationCopy(item: RankedResult): string {
  return item.priceSummary?.verified
    ? SEARCH_LANGUAGE.pricing.verified
    : SEARCH_LANGUAGE.pricing.unverified;
}

export function reviewNoteCopy(item: RankedResult): string {
  const review = item.reviewSummary;
  if (review?.sourcesDisagree) return SEARCH_LANGUAGE.reviews.disagreement;
  return review?.recency ?? SEARCH_LANGUAGE.reviews.noDate;
}

export function saveActionCopy(state: SaveState, isAuthenticated: boolean): string {
  if (state === "saving") return SEARCH_LANGUAGE.save.saving;
  if (state === "saved") return SEARCH_LANGUAGE.save.saved;
  return isAuthenticated ? SEARCH_LANGUAGE.save.idle : SEARCH_LANGUAGE.save.signedOut;
}

export function saveAriaLabel(item: RankedResult, state: SaveState, isAuthenticated: boolean): string {
  if (state === "saved") return `${item.name} saved`;
  if (state === "saving") return `Saving ${item.name}`;
  return isAuthenticated ? `Save ${item.name}` : `Log in to save ${item.name}`;
}

export function requestErrorCopy(status: number, code?: string): string {
  if (status === 429 || code === "rate_limited") {
    return "Searches are coming in quickly. Wait a moment, then try again.";
  }
  if (status === 503) return "Crossing can’t reach its sources right now. Try again in a moment.";
  if (status === 400 || code === "invalid_body") {
    return "That request couldn’t be read. Try describing what you need in a different way.";
  }
  return "That search didn’t finish. Try again.";
}

export function searchArea(query: string): SearchArea {
  const value = query.toLowerCase();
  if (/\b(near me|nearby|restaurant|coffee shop|cafe|dentist|electrician|plumber|repair|open now|local)\b/.test(value)) {
    return "local";
  }
  if (/\b(headphones|laptop|phone|camera|mattress|shoes|vacuum|monitor|keyboard|physical product|buy)\b/.test(value)) {
    return "product";
  }
  if (/\b(software|tool|platform|app|analytics|hosting|email|project management|design|saas|api)\b/.test(value)) {
    return "software";
  }
  return "other";
}

function clarificationTitle(options: string[], query: string): string {
  const queryText = query.toLowerCase();
  if (queryText.includes("analytics") || (options.length === 1 && options[0]?.toLowerCase().includes("analytics"))) {
    return "Which kind of analytics are you looking for?";
  }
  if (searchArea(query) === "local") return "What kind of place are you looking for?";
  if (searchArea(query) === "product") return "What kind of product are you looking for?";
  return "Which kind of tool are you looking for?";
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
