import { z } from "zod";
import { toResponse, fail, fromThrown, zodFields } from "@/lib/server/api-result";
import { guardSavedRequest, readJson } from "@/features/saved/guard";
import {
  addItemToCollection,
  removeItemFromCollection,
  moveItemBetweenCollections,
} from "@/features/saved/service";

// ─── /api/saved/collections/[id]/items ─────────────────────────────────────────
// POST   — add a saved item to this collection, or MOVE it here by supplying
//          `fromCollectionId`.
// DELETE — remove a saved item from this collection.
//
// Both the collection AND the saved item must belong to the caller.

const addSchema = z.object({
  savedItemId: z.string().trim().min(1).max(64),
  /** When present the item is moved out of this collection into `[id]`. */
  fromCollectionId: z.string().trim().min(1).max(64).optional(),
});

const removeSchema = z.object({
  savedItemId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "collection" });
  if (!guard.ok) return toResponse(guard);

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);

  const parsed = addSchema.safeParse(body.data);
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid collection item.", zodFields(parsed.error)));
  }

  const { id } = await params;
  const { savedItemId, fromCollectionId } = parsed.data;

  try {
    if (fromCollectionId) {
      return toResponse(
        await moveItemBetweenCollections(guard.data.store, guard.data.userId, {
          savedItemId,
          fromCollectionId,
          toCollectionId: id,
        })
      );
    }
    return toResponse(await addItemToCollection(guard.data.store, guard.data.userId, id, savedItemId));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.addItem"));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "collection" });
  if (!guard.ok) return toResponse(guard);

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);

  const parsed = removeSchema.safeParse(body.data);
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid collection item.", zodFields(parsed.error)));
  }

  const { id } = await params;
  try {
    return toResponse(
      await removeItemFromCollection(guard.data.store, guard.data.userId, id, parsed.data.savedItemId)
    );
  } catch (err) {
    return toResponse(fromThrown(err, "saved.collections.removeItem"));
  }
}
