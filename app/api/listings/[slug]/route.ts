import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/rate-limit";
import { getListingBySlug, incrementListingView } from "@/features/listings/data";
import { mapListingDetail } from "@/features/listings/dto";
import { hasSaved } from "@/features/saves/data";
import { hasVoted } from "@/features/votes/data";

// ─── GET /api/listings/[slug] ─────────────────────────────────────────────────
// Public. Optionally authenticated — when a valid session is present, the
// response includes whether the caller has saved/voted this listing.
// Also increments the view counter (rate-limited, see incrementListingView).

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing || listing.status !== "PUBLISHED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Best-effort — never let a view-count hiccup break the page load.
  incrementListingView(listing.id, clientIp(request)).catch(() => {});

  const user = await requireAuth(request);
  const [saved, voted] = user
    ? await Promise.all([hasSaved(user.id, listing.id), hasVoted(user.id, listing.id)])
    : [false, false];

  return NextResponse.json({
    listing: mapListingDetail(listing),
    savedByCurrentUser: saved,
    votedByCurrentUser: voted,
  });
}
