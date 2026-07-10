import { NextResponse } from "next/server";
import { db, DB_AVAILABLE } from "@/lib/db";
import { requireOwnerApi } from "@/lib/server/admin";

// ─── GET /api/admin/access/users/search?q= ───────────────────────────────────
// Search users for role management. OWNER only.
// Returns id, name, role, email (masked), roleChangedAt, grantedBy.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  let owner;
  try {
    owner = await requireOwnerApi(request);
  } catch {
    return NextResponse.json({ error: "auth_error" }, { status: 500 });
  }

  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "query_too_short" }, { status: 400 });
  }

  try {
    const users = await db.user.findMany({
      where: {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { id:    { equals: q } },
        ],
      },
      take: 20,
      select: {
        id:             true,
        name:           true,
        email:          true,
        role:           true,
        verified:       true,
        createdAt:      true,
        suspendedAt:    true,
        image:          true,
        // Role tracking — added after initial schema; may be null on older rows
        roleChangedAt:   true,
        roleGrantedById: true,
      },
    });

    // Look up grantor display names
    const grantorIds = [
      ...new Set(
        users
          .map((u) => u.roleGrantedById)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];

    const grantors = grantorIds.length > 0
      ? await db.user.findMany({
          where:  { id: { in: grantorIds } },
          select: { id: true, name: true },
        })
      : [];

    const grantorMap = new Map(grantors.map((g) => [g.id, g]));

    const result = users.map((u) => {
      const grantor = u.roleGrantedById ? grantorMap.get(u.roleGrantedById) ?? null : null;

      // Mask email: show first 2 chars + domain
      const maskedEmail = u.email
        ? u.email.replace(/^(.{0,2}).*(@.+)$/, (_, prefix, domain) => `${prefix}…${domain}`)
        : null;

      return {
        id:          u.id,
        name:        u.name,
        maskedEmail,
        role:        u.role as string,
        verified:    u.verified,
        suspended:   !!u.suspendedAt,
        createdAt:   u.createdAt.toISOString(),
        roleChangedAt:  u.roleChangedAt?.toISOString() ?? null,
        grantedBy: grantor
          ? { id: grantor.id, name: grantor.name }
          : null,
        avatarUrl: u.image ?? null,
      };
    });

    return NextResponse.json({ users: result });
  } catch (err) {
    console.error("[/api/admin/access/users/search] DB error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Search failed. Check server logs." },
      { status: 500 }
    );
  }
}
