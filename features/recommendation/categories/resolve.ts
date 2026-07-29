/**
 * Category resolution — the strict gate that runs BEFORE candidate retrieval.
 *
 * This is the safety layer added after the pipeline was found ranking a local
 * "coffee shop" query against seeded software (DriftDeploy etc.). The rule is
 * simple and absolute:
 *
 *   The engine may only retrieve and rank candidates when a *supported*
 *   software category has been resolved with sufficient confidence — either
 *   from the query text or from an explicit user selection.
 *
 * Every other outcome (a recognized-but-unsupported domain like a café, an
 * ambiguous keyword, or a fully unknown query) resolves to a NON-supported
 * status and the pipeline short-circuits without touching the corpus. There is
 * no "null category → all categories" fallback anywhere downstream.
 *
 * Deterministic and dependency-free: no AI, no network. The unsupported-domain
 * lexicon exists only to give the user a truthful "we don't cover this yet"
 * message — it never adds a rankable category.
 */

import { detectCategory, getCategory, listCategories } from "./definitions";

export type CategoryDomain =
  | "software"
  | "local-business"
  | "product"
  | "service"
  | "media"
  | "unknown";

export type CategoryStatus = "supported" | "unsupported" | "ambiguous" | "unknown";

export interface CategoryResolution {
  /** The broad kind of thing the query is about, as best we can tell. */
  domain: CategoryDomain;
  /** The resolved supported category id, or null when we won't/can't rank. */
  categoryId: string | null;
  /** Human label for the resolved or recognized category/domain. */
  categoryLabel?: string;
  /** Whether the engine is allowed to rank for this query. */
  status: CategoryStatus;
  /** 0..1 confidence in the resolution. */
  confidence: number;
  /** When not "supported", the nearest supported categories to offer the user. */
  suggestedCategoryIds: string[];
  /** True when the recognized domain fundamentally needs a location (e.g. local business). */
  requiresLocation: boolean;
}

/**
 * A keyword match must clear this confidence bar to auto-proceed. Below it the
 * query is treated as ambiguous and the user is asked to pick a category rather
 * than the engine guessing. Deliberately configurable in one place.
 */
export const CATEGORY_CONFIDENCE_THRESHOLD = 0.6;

// ─── Recognized-but-unsupported domain lexicon ───────────────────────────────
// Purely for honest messaging. These terms map a query to a real-world domain
// Crossing does NOT cover in the software MVP, so we can say so specifically
// instead of silently ranking software. Order: most specific phrases first.

interface UnsupportedSignal {
  domain: Exclude<CategoryDomain, "software" | "unknown">;
  label: string;
  requiresLocation: boolean;
  terms: string[];
}

const UNSUPPORTED_SIGNALS: UnsupportedSignal[] = [
  {
    domain: "local-business",
    label: "Local business",
    requiresLocation: true,
    terms: [
      "coffee shop", "coffeeshop", "cafe", "café", "restaurant", "diner", "bakery",
      "bar", "pub", "brewery", "gym", "salon", "barber", "spa", "hotel", "motel",
      "plumber", "electrician", "handyman", "locksmith", "mechanic", "dentist",
      "doctor", "clinic", "hospital", "pharmacy", "vet", "veterinarian",
      "grocery", "store", "shop near", "near me", "nearby", "in my area",
      "walking distance", "open late", "late-night", "late night",
    ],
  },
  {
    domain: "service",
    label: "Local service",
    requiresLocation: true,
    terms: [
      "cleaner", "house cleaner", "cleaning service", "landscaper", "lawn care",
      "contractor", "roofer", "painter", "mover", "movers", "tutor", "babysitter",
      "photographer", "caterer", "lawyer", "attorney", "accountant", "therapist",
      "personal trainer",
    ],
  },
  {
    domain: "product",
    label: "Physical product",
    requiresLocation: false,
    terms: [
      "camera", "headphones", "earbuds", "laptop", "mattress", "vacuum",
      "blender", "microwave", "refrigerator", "washing machine", "tv", "television",
      "monitor", "keyboard", "mouse", "backpack", "shoes", "sneakers", "watch",
      "sunglasses", "coffee maker", "espresso machine", "grill", "drone",
      "bike", "bicycle", "car", "stroller", "office chair",
    ],
  },
  {
    domain: "media",
    label: "Media & entertainment",
    requiresLocation: false,
    terms: [
      "movie", "film", "tv show", "series", "book", "novel", "album",
      "podcast", "song", "video game", "board game",
    ],
  },
];

function padded(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function matchUnsupported(q: string): UnsupportedSignal | null {
  const hay = padded(q);
  for (const signal of UNSUPPORTED_SIGNALS) {
    for (const term of signal.terms) {
      // Phrase match with word boundaries via the padded haystack.
      if (hay.includes(` ${term} `) || hay.includes(` ${term}`) || hay.includes(`${term} `)) {
        return signal;
      }
    }
  }
  return null;
}

/** All supported categories whose name/alias appears in the query, best-first. */
function matchSupported(q: string): { categoryId: string; confidence: number }[] {
  const hay = padded(q);
  const hits: { categoryId: string; score: number }[] = [];
  for (const category of listCategories()) {
    const needles = [category.name.toLowerCase(), ...category.aliases];
    let best = 0;
    for (const needle of needles) {
      if (hay.includes(` ${needle} `) || hay.includes(`${needle}s `) || hay.includes(` ${needle}`)) {
        best = Math.max(best, needle.length);
      }
    }
    if (best > 0) hits.push({ categoryId: category.id, score: best });
  }
  hits.sort((a, b) => b.score - a.score || a.categoryId.localeCompare(b.categoryId));
  // Mirror detectCategory's confidence curve so behavior stays consistent.
  return hits.map((h) => ({ categoryId: h.categoryId, confidence: Math.min(0.5 + h.score / 40, 0.9) }));
}

/**
 * Resolve a query (and an optional explicit category) into a gating decision.
 *
 * @param rawQuery       the user's natural-language query
 * @param explicitCategoryId  a category the user deliberately selected, if any
 */
export function resolveCategory(
  rawQuery: string,
  explicitCategoryId?: string | null
): CategoryResolution {
  // 1. An explicit, valid selection always wins — the user told us the category.
  if (explicitCategoryId) {
    const cat = getCategory(explicitCategoryId);
    if (cat) {
      return {
        domain: "software",
        categoryId: cat.id,
        categoryLabel: cat.name,
        status: "supported",
        confidence: 1,
        suggestedCategoryIds: [],
        requiresLocation: false,
      };
    }
    // An explicit id we don't recognize is a client error, not a licence to guess.
    return {
      domain: "unknown",
      categoryId: null,
      status: "unknown",
      confidence: 0,
      suggestedCategoryIds: [],
      requiresLocation: false,
    };
  }

  const supported = matchSupported(rawQuery);
  const top = supported[0];

  // 2. A confident supported match → rank it.
  if (top && top.confidence >= CATEGORY_CONFIDENCE_THRESHOLD) {
    const cat = getCategory(top.categoryId)!;
    return {
      domain: "software",
      categoryId: cat.id,
      categoryLabel: cat.name,
      status: "supported",
      confidence: top.confidence,
      suggestedCategoryIds: supported.slice(1, 3).map((s) => s.categoryId),
      requiresLocation: false,
    };
  }

  // 3. A recognized real-world domain we don't cover → say so, never rank.
  const unsupported = matchUnsupported(rawQuery);
  if (unsupported) {
    return {
      domain: unsupported.domain,
      categoryId: null,
      categoryLabel: unsupported.label,
      status: "unsupported",
      confidence: 0.7,
      suggestedCategoryIds: [],
      requiresLocation: unsupported.requiresLocation,
    };
  }

  // 4. A weak/short keyword hit → ambiguous; ask, don't guess.
  if (top) {
    return {
      domain: "software",
      categoryId: null,
      status: "ambiguous",
      confidence: top.confidence,
      suggestedCategoryIds: supported.slice(0, 3).map((s) => s.categoryId),
      requiresLocation: false,
    };
  }

  // 5. Nothing recognizable.
  return {
    domain: "unknown",
    categoryId: null,
    status: "unknown",
    confidence: 0,
    suggestedCategoryIds: [],
    requiresLocation: false,
  };
}

/** Re-export for callers that only need the keyword confidence (kept for parity). */
export { detectCategory };
