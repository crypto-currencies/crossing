import { toResponse, ok, fail, fromThrown, zodFields } from "@/lib/server/api-result";
import { guardSavedRequest, readJson } from "@/features/saved/guard";
import { createCollection, collectionInputSchema } from "@/features/saved/service";

// ─── /api/saved/collections ────────────────────────────────────────────────────
// GET  — the caller's collections (always user-scoped at the query level)
// POST — create a collection (duplicate names rejected with `conflict`)

export async function GET(request: Request) {
  const guard = await guardSavedRequest(request);
  if (!guard.ok) return toResponse(guard);

  try {
    const collections = await guard.data.store.listCollections(guard.data.userId);
    return toResponse(
      ok({
        collections: collections.map((c) => ({ id: c.id, name: c.name, slug: c.slug, position: c.position })),
      })
    );
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.list"));
  }
}

export async function POST(request: Request) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "collection" });
  if (!guard.ok) return toResponse(guard);

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);

  const parsed = collectionInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid collection.", zodFields(parsed.error)));
  }

  try {
    const result = await createCollection(guard.data.store, guard.data.userId, parsed.data.name);
    if (!result.ok) return toResponse(result);
    const c = result.data;
    return toResponse(ok({ collection: { id: c.id, name: c.name, slug: c.slug, position: c.position } }));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.create"));
  }
}
