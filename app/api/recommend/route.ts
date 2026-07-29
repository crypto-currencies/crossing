import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { getLiveSearch } from "@/features/search/live-default";
import { httpStatusFor, MAX_PAGE_SIZE } from "@/features/search/response";
import { toLegacyResponse } from "@/features/search/compat";
import { MAX_QUERY_LENGTH } from "@/features/recommendation/api";

// ─── POST /api/recommend ─────────────────────────────────────────────────────
//
// Public, rate-limited. Runs the live search orchestrator: layered candidate
// discovery → entity resolution → classified evidence → deterministic ranking.
//
// TWO CONTRACTS, ONE PIPELINE:
//   default        → the legacy { bestMatch, alternatives } shape the current
//                    search UI consumes, projected from the ranked list.
//   contract:"ranked" → the full RankedSearchResponse (10–20 results, coverage,
//                    pagination). New clients should use this.
//
// The projection is a rendering of the same ranked list, not a second engine
// (see features/search/compat.ts). When the UI moves to the ranked contract,
// the default flips and compat.ts is deleted.
//
// This endpoint never serves fixture data in production — if live discovery is
// unavailable it returns a truthful 503 rather than fictional results.

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  query: z.string().trim().min(1, "empty_query").max(MAX_QUERY_LENGTH, "query_too_long"),
  categoryId: z.string().trim().min(1).max(64).optional(),
  /** Ranked-contract page size. */
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  /** Opaque pagination cursor from a previous ranked response. */
  cursor: z.string().max(512).optional(),
  /** Which response shape to return. */
  contract: z.enum(["legacy", "ranked"]).optional(),
  /** Legacy alias for `limit`, kept so existing callers keep working. */
  resultCount: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export async function POST(request: Request) {
  const requestId = randomId();

  // Rate limit — search is the cheapest way to burn the provider budget.
  const ip = clientIp(request);
  if (!(await rateLimit(`recommend:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: "rate_limited", requestId }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", requestId }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten().fieldErrors, requestId },
      { status: 400 }
    );
  }

  const { query, categoryId, cursor, contract } = parsed.data;
  const limit = parsed.data.limit ?? parsed.data.resultCount;

  try {
    // The orchestrator emits its own structured log line per search and never
    // throws for a failed source — it degrades and reports.
    const ranked = await getLiveSearch().search({
      query,
      ...(categoryId ? { categoryId } : {}),
      ...(limit ? { limit } : {}),
      ...(cursor ? { cursor } : {}),
    });

    const status = httpStatusFor(ranked);

    if (contract === "ranked") {
      return NextResponse.json(ranked, { status });
    }

    return NextResponse.json(toLegacyResponse(ranked), { status });
  } catch (err) {
    console.error(`[recommend] ${requestId} failed:`, err);
    return NextResponse.json(
      { status: "error", code: "internal_error", requestId, message: "Something went wrong." },
      { status: 500 }
    );
  }
}

// Queries stay out of GET: they can be long, and they can carry personal detail
// that does not belong in a URL, a referrer header, or a proxy cache.
export function GET() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      hint: `POST a JSON body { query } (max ${MAX_QUERY_LENGTH} chars). Add contract:"ranked" for the full ranked list.`,
    },
    { status: 405 }
  );
}
