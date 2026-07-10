/**
 * Content filter — blocks slurs while permitting general profanity.
 *
 * What's blocked: racial, homophobic, transphobic, and ableist slurs.
 * What's allowed: fuck, shit, ass, bitch, damn, crap, and most profanity.
 *
 * Evasion handling:
 *   - Leetspeak substitutions (n1gg3r, n!gger, @, $, etc.)
 *   - Separator evasion (n-i-g-g-e-r, n.i.g.g.e.r, n i g g e r)
 *   - Repeated-character padding (niiiigger)
 *
 * Design notes:
 *   - Word boundaries (\b) on the primary pass prevent matching innocent
 *     substrings (e.g. "niggardly", "assassin").
 *   - A secondary pass strips non-alpha separators and re-tests individual
 *     tokens, catching punctuation-spaced evasion.
 *   - A third pass collapses runs of single separated letters to catch
 *     space-spaced letter-by-letter evasion ("n i g g e r").
 */

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return (
    text
      .toLowerCase()
      // common leetspeak substitutions
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/[1!|]/g, "i")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/ph/g, "f")
      // collapse repeated letters (niiiigger → nigger) — limited to 3+ repeats
      // to avoid collapsing legitimate doubled letters like "ll", "ss"
      .replace(/(.)\1{2,}/g, "$1$1")
  );
}

/**
 * Collapse spaced-out letter evasion.
 * "n i g g e r"  →  "nigger"
 * "n-i-g-g-e-r"  →  "nigger"
 * "n.i.g.g.e.r"  →  "nigger"
 * Only collapses sequences where every token is a single letter followed by
 * a separator — won't collapse normal words separated by spaces.
 */
function collapseSpacedLetters(text: string): string {
  // Matches 3+ occurrences of (single-letter + separator), followed by a
  // final single letter — the minimum length for any slur in our list is 3.
  return text.replace(/\b(?:[a-z][\s\-_.,"'*]+){2,}[a-z]\b/g, (match) =>
    match.replace(/[^a-z]/g, "")
  );
}

// ─── Slur patterns ────────────────────────────────────────────────────────────
// Rules for inclusion:
//   1. Must be an established slur targeting a protected group.
//   2. Must not generate unacceptable false-positive rates in normal text.
//   3. Patterns are tested on normalised text (after leetspeak substitution).

const SLUR_PATTERNS: RegExp[] = [
  // ── Racial / ethnic ─────────────────────────────────────────────────────────
  /\bnigge?rs?\b/,           // nigger / niggers
  /\bniggas?\b/,             // nigga — also used as slur
  /\bniglets?\b/,            // niglet
  /\bjigaboos?\b/,           // jigaboo
  /\bsambos?\b/,             // sambo
  /\bpickaninn(?:y|ies)\b/,  // pickaninny
  /\bcoons?\b/,              // coon (racial)
  /\bporch\s*monkeys?\b/,    // porch monkey
  /\bdarkies?\b/,            // darky/darkies
  /\bchinks?\b/,             // chink
  /\bchinaman\b/,            // chinaman
  /\bchinawom[ae]n\b/,       // chinawoman
  /\bslants?\b/,             // slant (anti-Asian)
  /\bgooks?\b/,              // gook
  /\bjaps?\b/,               // jap (anti-Japanese)
  /\bzipperheads?\b/,        // zipperhead
  /\bspics?\b/,              // spic
  /\bspiks?\b/,              // spik
  /\bwetbacks?\b/,           // wetback
  /\bbeaners?\b/,            // beaner
  /\bkikes?\b/,              // kike
  /\bwops?\b/,               // wop (anti-Italian)
  /\bdagos?\b/,              // dago (anti-Italian/Spanish)
  /\bpakis?\b/,              // paki
  /\bwogs?\b/,               // wog
  /\bgypos?\b/,              // gypo (anti-Romani)
  /\bgreasers?\b/,           // greaser (ethnic)
  /\bsandnigge?rs?\b/,       // sandnigger (compound)
  /\bwigge?rs?\b/,           // wigger
  /\bhonkies?\b|\bhonky\b/,  // honky
  /\bcrackers?\b/,           // cracker (anti-white slur)

  // ── Homophobic ──────────────────────────────────────────────────────────────
  /\bfaggots?\b/,            // faggot
  /\bfaggy\b/,               // faggy
  /\bdykes?\b/,              // dyke
  /\bpoofters?\b/,           // poofter
  /\bpoofs?\b/,              // poof

  // ── Transphobic ─────────────────────────────────────────────────────────────
  /\btrannie[sz]?\b/,        // trannie
  /\btranniess?\b/,          // trannies
  /\btranys?\b/,             // trany (misspelling)
  /\bshemales?\b/,           // shemale
  /\bhe\s*-?\s*shes?\b/,     // he-she

  // ── Ableist ─────────────────────────────────────────────────────────────────
  /\bretards?\b/,            // retard
  /\bretarded\b/,            // retarded
  /\bspastics?\b/,           // spastic (UK disability slur)
  /\bspazzes?\b|\bspaz\b/,   // spaz/spazz

  // ── Misogynistic ────────────────────────────────────────────────────────────
  /\bcunts?\b/,              // cunt (listed explicitly by operator)
];

// ─── Detection ────────────────────────────────────────────────────────────────

function matchesAnyPattern(text: string): boolean {
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function containsSlur(raw: string): boolean {
  // Pass 1 — normalise + collapse repeated chars, then test with word boundaries.
  const normalized = normalizeText(raw);
  if (matchesAnyPattern(normalized)) return true;

  // Pass 2 — collapse spaced / punctuated letter-by-letter evasion, then re-test.
  const collapsed = collapseSpacedLetters(normalized);
  if (collapsed !== normalized && matchesAnyPattern(collapsed)) return true;

  // Pass 3 — strip non-alpha separators from each whitespace-delimited token
  // individually and test. Catches "f.a.g.g.o.t", "n-i-g-g-e-r" (as one token).
  const tokens = normalized.split(/\s+/);
  for (const token of tokens) {
    if (token.length < 2) continue;
    const stripped = token.replace(/[^a-z]/g, "");
    if (!stripped || stripped === token) continue; // already clean — pass 1 handled it
    // Test stripped token as an exact whole-word match against each pattern
    for (const pattern of SLUR_PATTERNS) {
      // Remove \b anchors and wrap in ^ ... $ for an exact-match check
      const exactSrc = pattern.source.replace(/\\b/g, "");
      if (new RegExp(`^(?:${exactSrc})$`).test(stripped)) return true;
    }
  }

  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FilterResult {
  blocked: boolean;
  /** User-facing rejection reason, only set when blocked === true. */
  reason?: string;
}

export function filterMessage(text: string): FilterResult {
  if (containsSlur(text)) {
    return {
      blocked: true,
      reason: "Your message contains language that isn't allowed on this platform.",
    };
  }
  return { blocked: false };
}
