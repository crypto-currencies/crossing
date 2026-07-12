import { NextResponse } from "next/server";
import { DB_AVAILABLE, db } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { addVote, removeVote } from "@/features/votes/data";

async function resolveListingId(slug: string): Promise<string | null> {
  const listing = await db.listing.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  return listing && listing.status === "PUBLISHED" ? listing.id : null;
}

// ─── POST /api/listings/[slug]/vote ───────────────────────────────────────────
// Authenticated. Idempotent — voting for an already-voted listing is a no-op success.

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "suspended" }, { status: 403 });

  if (!(await rateLimit(`vote:${clientIp(request)}:${user.id}`, 30, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { slug } = await params;
  const listingId = await resolveListingId(slug);
  if (!listingId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await addVote(user.id, listingId);
  return NextResponse.json(result);
}

// ─── DELETE /api/listings/[slug]/vote ─────────────────────────────────────────
// Authenticated.

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!DB_AVAILABLE) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const listingId = await resolveListingId(slug);
  if (!listingId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await removeVote(user.id, listingId);
  return NextResponse.json(result);
}
