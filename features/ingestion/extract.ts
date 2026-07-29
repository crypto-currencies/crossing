/**
 * Factual extraction from an approved page.
 *
 * Precedence: JSON-LD (schema.org) → standard metadata → semantic HTML →
 * restricted fallback selectors. Dependency-free and deliberately conservative:
 * it extracts STRUCTURED facts and provenance, never marketing adjectives.
 * Superlatives like "best", "fastest", "most trusted" are treated as copy, not
 * facts, and are filtered out of feature candidates.
 *
 * Every fact carries provenance: how it was found, a short supporting excerpt,
 * and a confidence weight. Extraction is versioned (EXTRACTION_VERSION) so a
 * change in logic is visible in snapshots.
 */

export const EXTRACTION_VERSION = "official-site@1";

export type ExtractionMethod = "json-ld" | "meta" | "semantic" | "fallback";

const METHOD_CONFIDENCE: Record<ExtractionMethod, number> = {
  "json-ld": 0.9,
  meta: 0.75,
  semantic: 0.6,
  fallback: 0.4,
};

export interface Fact<T> {
  value: T;
  method: ExtractionMethod;
  /** Short, escaped-at-render supporting text (never full HTML). */
  sourceText: string;
  confidence: number;
}

export interface ExtractedEvidence {
  name: Fact<string> | null;
  canonicalUrl: Fact<string> | null;
  description: Fact<string> | null;
  logoUrl: Fact<string> | null;
  title: Fact<string> | null;
  hasFreePlan: Fact<boolean> | null;
  hasFreeTrial: Fact<boolean> | null;
  billingPeriods: Fact<string[]> | null;
  platforms: Fact<string[]> | null;
  integrations: Fact<string[]> | null;
  features: Fact<string[]> | null;
  docsLinks: Fact<string[]> | null;
  contactLinks: Fact<string[]> | null;
  /** Raw schema.org SoftwareApplication fields we recognized (for provenance). */
  softwareFields: Fact<Record<string, string>> | null;
  lastModified: Fact<string> | null;
  /** Raw price statements found in JSON-LD offers or price-like copy. */
  priceStatements: { text: string; method: ExtractionMethod; amount: number | null; currency: string | null }[];
}

const SUPERLATIVES = /\b(best|fastest|most trusted|number one|#1|world.?class|leading|ultimate|greatest)\b/i;

// Common navigation/marketing labels that are not product features or integrations.
// A generalizable denylist (not tied to any site's markup) to reduce fallback noise.
const NAV_NOISE = /\b(log ?in|sign ?up|sign ?in|menu|blog|podcast|pricing|contact|demo|help ?centre|help ?center|docs?|documentation|home|about|careers?|guides?|troubleshooting|newsletter|webinar|download|get started|start free|free trial|login start)\b/i;

/** Drop obvious nav/marketing labels and over-long phrases from feature/integration lists. */
function cleanLabels(items: string[]): string[] {
  return items.filter((t) => !NAV_NOISE.test(t) && !/\bvs\b/i.test(t) && t.split(/\s+/).length <= 5);
}

function fact<T>(value: T, method: ExtractionMethod, sourceText: string): Fact<T> {
  return { value, method, sourceText: excerpt(sourceText), confidence: METHOD_CONFIDENCE[method] };
}

export function excerpt(text: string, max = 200): string {
  return decodeEntities(text).replace(/\s+/g, " ").trim().slice(0, max);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

// ─── Low-level HTML readers (constrained, controlled input only) ─────────────

export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* invalid JSON-LD is ignored, not fatal */
    }
  }
  // Flatten @graph containers.
  const flat: unknown[] = [];
  for (const node of out) {
    if (node && typeof node === "object" && Array.isArray((node as Record<string, unknown>)["@graph"])) {
      flat.push(...((node as Record<string, unknown>)["@graph"] as unknown[]));
    } else {
      flat.push(node);
    }
  }
  return flat;
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? "";
  }
  return attrs;
}

export function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const re = /<meta\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const key = (attrs.name || attrs.property || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content != null) meta[key] = decodeEntities(attrs.content);
  }
  return meta;
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim() : null;
}

export function extractLinks(html: string): { rel: string; href: string }[] {
  const out: { rel: string; href: string }[] = [];
  const re = /<link\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    if (attrs.rel && attrs.href) out.push({ rel: attrs.rel.toLowerCase(), href: attrs.href });
  }
  return out;
}

/** Anchor hrefs + their (tag-stripped) text. */
export function extractAnchors(html: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    if (attrs.href) out.push({ href: attrs.href, text: stripTags(m[2]).trim() });
  }
  return out;
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ─── schema.org helpers ───────────────────────────────────────────────────────

function typeOf(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const t = (node as Record<string, unknown>)["@type"];
  if (typeof t === "string") return [t.toLowerCase()];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string").map((x) => (x as string).toLowerCase());
  return [];
}

function findNode(nodes: unknown[], types: string[]): Record<string, unknown> | null {
  for (const n of nodes) {
    const t = typeOf(n);
    if (t.some((x) => types.includes(x))) return n as Record<string, unknown>;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface ExtractContext {
  url: string;
  /** From the HTTP Last-Modified header, when present. */
  httpLastModified?: string | null;
}

export function extractEvidence(html: string, ctx: ExtractContext): ExtractedEvidence {
  const jsonld = extractJsonLd(html);
  const meta = extractMetaTags(html);
  const title = extractTitle(html);
  const links = extractLinks(html);
  const anchors = extractAnchors(html);

  const app = findNode(jsonld, ["softwareapplication", "webapplication", "product"]);
  const org = findNode(jsonld, ["organization", "corporation"]);
  const website = findNode(jsonld, ["website"]);

  const out: ExtractedEvidence = {
    name: null, canonicalUrl: null, description: null, logoUrl: null, title: null,
    hasFreePlan: null, hasFreeTrial: null, billingPeriods: null, platforms: null,
    integrations: null, features: null, docsLinks: null, contactLinks: null,
    softwareFields: null, lastModified: null, priceStatements: [],
  };

  // Name
  const nameJl = app && str(app.name);
  if (nameJl) out.name = fact(nameJl, "json-ld", `schema.org name: ${nameJl}`);
  else if (meta["og:site_name"]) out.name = fact(meta["og:site_name"], "meta", `og:site_name`);
  else if (meta["application-name"]) out.name = fact(meta["application-name"], "meta", `application-name`);
  else if (title) out.name = fact(title.split(/[|\-–—]/)[0].trim(), "semantic", `<title>`);

  // Canonical URL
  const canon = links.find((l) => l.rel === "canonical");
  if (canon) out.canonicalUrl = fact(canon.href, "meta", `<link rel=canonical>`);
  else if (meta["og:url"]) out.canonicalUrl = fact(meta["og:url"], "meta", `og:url`);
  else out.canonicalUrl = fact(ctx.url, "fallback", `request URL`);

  // Description
  const descJl = app && str(app.description);
  if (descJl) out.description = fact(descJl, "json-ld", descJl);
  else if (meta["og:description"]) out.description = fact(meta["og:description"], "meta", `og:description`);
  else if (meta["description"]) out.description = fact(meta["description"], "meta", `meta description`);

  // Logo
  let logoJl: string | null = null;
  if (org) {
    const lg = org.logo;
    if (typeof lg === "string") logoJl = lg.trim() || null;
    else if (lg && typeof lg === "object") logoJl = str((lg as Record<string, unknown>).url);
  }
  if (logoJl) out.logoUrl = fact(logoJl, "json-ld", `schema.org logo`);
  else if (meta["og:image"]) out.logoUrl = fact(meta["og:image"], "meta", `og:image`);
  const iconLink = links.find((l) => l.rel.includes("icon"));
  if (!out.logoUrl && iconLink) out.logoUrl = fact(iconLink.href, "semantic", `<link rel=icon>`);

  // Title (page)
  if (title) out.title = fact(title, "semantic", `<title>`);

  // Last-modified
  if (ctx.httpLastModified) out.lastModified = fact(ctx.httpLastModified, "meta", `Last-Modified header`);
  else if (meta["article:modified_time"]) out.lastModified = fact(meta["article:modified_time"], "meta", `article:modified_time`);

  // schema.org software fields
  if (app) {
    const sf: Record<string, string> = {};
    for (const k of ["applicationCategory", "operatingSystem", "softwareVersion", "downloadUrl"]) {
      const v = str(app[k]);
      if (v) sf[k] = v;
    }
    if (Object.keys(sf).length) out.softwareFields = fact(sf, "json-ld", `SoftwareApplication fields`);

    // operatingSystem → platforms
    const os = str(app.operatingSystem);
    if (os) out.platforms = fact(normalizePlatforms(os), "json-ld", `operatingSystem: ${os}`);
  }

  // Offers → price statements + free plan/trial
  collectOffers(app, out);

  // Capture price/pricing-signal sentences from body copy so cautious pricing
  // normalization can see explicit statements like "$29/month".
  const bodyText = stripTags(html).toLowerCase();
  const priceSignal = /(\$|£|€|\busd\b|\beur\b|\bgbp\b|\/mo\b|per month|per year|contact sales|free trial|usage[-\s]?based|pay[-\s]?as[-\s]?you[-\s]?go)/i;
  let captured = 0;
  for (const sentence of bodyText.split(/[.!?\n]/)) {
    const s = sentence.trim();
    if (s && s.length <= 160 && priceSignal.test(s) && captured < 10) {
      out.priceStatements.push({ text: excerpt(s), method: "semantic", amount: null, currency: null });
      captured++;
    }
  }

  // Free plan / trial from body copy — negation-aware ("no free plan" ≠ free plan).
  const negFree = /\b(no|not|without|don'?t|doesn'?t)\s+(?:offer\s+)?(?:a\s+)?free\b/.test(bodyText);
  if (out.hasFreePlan == null) {
    if (/\bno free (plan|tier)\b/.test(bodyText)) {
      out.hasFreePlan = fact(false, "semantic", matchAround(bodyText, /no free (plan|tier)/));
    } else if (!negFree && /\bfree (plan|tier|forever|for ever)\b/.test(bodyText)) {
      out.hasFreePlan = fact(true, "semantic", matchAround(bodyText, /free (plan|tier|forever|for ever)/));
    }
  }
  // Plan-card style: a heading/term whose text is exactly "Free" / "Free plan".
  // Generalizable (heading elements + definition/table terms), not CSS-class-bound.
  if (out.hasFreePlan == null && !negFree) {
    // A pricing tier's price/label cell whose ENTIRE text is "Free" (or "Free plan").
    const cells = [...html.matchAll(/<(h[1-6]|dt|th|strong|p|span|td|dd|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) =>
      stripTags(m[2]).toLowerCase().trim()
    );
    if (cells.some((h) => h === "free" || h === "free plan" || h === "free tier" || h === "free forever")) {
      out.hasFreePlan = fact(true, "semantic", "plan/price labelled “Free”");
    }
  }
  // An explicit $0 / $0/mo tier also indicates a free plan.
  if (out.hasFreePlan == null && !negFree && /(?:^|\s)\$0\b/.test(bodyText)) {
    out.hasFreePlan = fact(true, "semantic", matchAround(bodyText, /\$0\b/));
  }
  if (out.hasFreeTrial == null && !/\bno free trial\b/.test(bodyText) && /\bfree trial\b/.test(bodyText)) {
    out.hasFreeTrial = fact(true, "semantic", matchAround(bodyText, /free trial/));
  }

  // Platforms fallback from copy (only explicit platform words).
  if (!out.platforms) {
    const plats = normalizePlatforms(bodyText);
    if (plats.length) out.platforms = fact(plats, "fallback", `platform keywords in copy`);
  }

  // Integrations: anchors under an integrations section-ish href.
  const integ = cleanLabels(
    anchors
      .filter((a) => /integrat/i.test(a.href) && a.text && a.text.length <= 40 && !SUPERLATIVES.test(a.text))
      .map((a) => a.text)
  );
  if (integ.length) out.integrations = fact(dedupe(integ).slice(0, 20), "fallback", `integration links`);

  // Features: schema.org featureList, else short list items that aren't superlatives.
  let featureList: string[] = [];
  if (app) {
    const fl = app.featureList;
    if (Array.isArray(fl)) featureList = fl.map(str).filter((s): s is string => !!s);
    else if (typeof fl === "string") featureList = fl.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (featureList.length) {
    out.features = fact(dedupe(featureList).slice(0, 20), "json-ld", `schema.org featureList`);
  } else {
    const items = cleanLabels(extractListItems(html).filter((t) => t.length >= 3 && t.length <= 60 && !SUPERLATIVES.test(t)));
    if (items.length) out.features = fact(dedupe(items).slice(0, 12), "fallback", `list items`);
  }

  // Docs + contact links.
  const docs = anchors.filter((a) => /\/docs|\/documentation|developers?\./i.test(a.href)).map((a) => a.href);
  if (docs.length) out.docsLinks = fact(dedupe(docs).slice(0, 10), "semantic", `documentation links`);
  const contact = anchors.filter((a) => /\/contact|\/support|mailto:/i.test(a.href)).map((a) => a.href);
  if (contact.length) out.contactLinks = fact(dedupe(contact).slice(0, 10), "semantic", `contact/support links`);

  void website;
  return out;
}

function collectOffers(app: Record<string, unknown> | null, out: ExtractedEvidence): void {
  if (!app) return;
  const offersRaw = app.offers;
  const offers: Record<string, unknown>[] = Array.isArray(offersRaw)
    ? (offersRaw as Record<string, unknown>[])
    : offersRaw && typeof offersRaw === "object"
      ? [offersRaw as Record<string, unknown>]
      : [];

  const billing = new Set<string>();
  for (const offer of offers) {
    const spec =
      offer.priceSpecification && typeof offer.priceSpecification === "object"
        ? (offer.priceSpecification as Record<string, unknown>)
        : null;
    const price = offer.price ?? (spec ? spec.price : undefined);
    const currency: string | null = str(offer.priceCurrency) ?? (spec ? str(spec.priceCurrency) : null);
    const amount = price != null && Number.isFinite(Number(price)) ? Number(price) : null;
    const text = `offer ${str(offer.name) ?? ""} ${amount ?? "?"} ${currency ?? ""}`.trim();
    out.priceStatements.push({ text: excerpt(text), method: "json-ld", amount, currency });
    if (amount === 0) out.hasFreePlan = fact(true, "json-ld", `offer price 0`);
    const period = str(spec ? spec.billingDuration : null) ?? str(offer.billingPeriod);
    if (period) billing.add(period.toLowerCase());
  }
  if (billing.size) out.billingPeriods = fact([...billing], "json-ld", `offer billing periods`);
}

const PLATFORM_WORDS = ["web", "windows", "macos", "mac", "linux", "ios", "android", "cli", "api", "chrome", "browser"];
function normalizePlatforms(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const p of PLATFORM_WORDS) {
    if (new RegExp(`\\b${p}\\b`).test(t)) found.add(p === "macos" ? "mac" : p === "browser" || p === "chrome" ? "web" : p);
  }
  return [...found];
}

function extractListItems(html: string): string[] {
  const out: string[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = stripTags(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function matchAround(text: string, re: RegExp, span = 60): string {
  const m = text.match(re);
  if (!m || m.index == null) return text.slice(0, span);
  const start = Math.max(0, m.index - span / 2);
  return excerpt(text.slice(start, m.index + m[0].length + span / 2));
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}
