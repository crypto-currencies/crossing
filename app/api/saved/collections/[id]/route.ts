import { toResponse, ok, fail, fromThrown, zodFields } from "@/lib/server/api-result";
import { guardSavedRequest, readJson } from "@/features/saved/guard";
import { renameCollection, deleteCollection, collectionInputSchema } from "@/features/saved/service";

// ─── /api/saved/collections/[id] ───────────────────────────────────────────────
// PATCH  — rename
// DELETE — delete
//
// A collection owned by another user is reported as `not_found`, never
// `forbidden`, so ids cannot be probed for existence.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "collection" });
  if (!guard.ok) return toResponse(guard);

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);

  const parsed = collectionInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid collection name.", zodFields(parsed.error)));
  }

  const { id } = await params;
  try {
    const result = await renameCollection(guard.data.store, guard.data.userId, id, parsed.data.name);
    if (!result.ok) return toResponse(result);
    const c = result.data;
    return toResponse(ok({ collection: { id: c.id, name: c.name, slug: c.slug, position: c.position } }));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.rename"));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "collection" });
  if (!guard.ok) return toResponse(guard);

  const { id } = await params;
  try {
    return toResponse(await deleteCollection(guard.data.store, guard.data.userId, id));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.delete"));
  }
}
