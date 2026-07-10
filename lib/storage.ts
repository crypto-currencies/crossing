/**
 * Low-level storage driver layer.
 *
 * Drivers (in priority order):
 *   1. Vercel Blob — set BLOB_READ_WRITE_TOKEN
 *   2. Local filesystem — automatic in NODE_ENV=development
 *   3. Null — throws StorageNotConfiguredError
 *
 * Use lib/server/storage.ts for the high-level API (uploadProfileAsset, deleteProfileAsset, etc.).
 * To add a new provider, add a check in storageUpload/storageDelete before the local fallback.
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { put, del as blobDel } from "@vercel/blob";

// ─── Error ────────────────────────────────────────────────────────────────────

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Upload storage is not configured. " +
        "In development this runs automatically. " +
        "In production, set BLOB_READ_WRITE_TOKEN (Vercel Blob) to enable uploads."
    );
    this.name = "StorageNotConfiguredError";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UploadedFile {
  url: string;
}

// Warn once per function instance (not once per request) to avoid log spam.
let _warnedUnconfigured = false;

/** Whether any upload driver is available in the current environment. */
export function storageConfigured(): boolean {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const isDev   = process.env.NODE_ENV === "development";

  if (!hasBlob && !isDev && !_warnedUnconfigured) {
    _warnedUnconfigured = true;
    console.warn(
      "[storage] BLOB_READ_WRITE_TOKEN is not set. " +
        "Avatar, banner, background, and music uploads are DISABLED. " +
        "Add it in Vercel → Project → Settings → Environment Variables.",
    );
  }

  return hasBlob || isDev;
}

/**
 * Upload a file buffer and return a public URL.
 * @param buffer    Raw file bytes
 * @param fileName  Original file name (used for extension)
 * @param mimeType  MIME type of the file
 * @param folder    Storage folder/prefix (e.g. "profiles/abc123/avatar")
 */
export async function storageUpload(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<UploadedFile> {
  // Vercel Blob (production) — requires BLOB_READ_WRITE_TOKEN
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      return await vercelBlobUpload(buffer, fileName, mimeType, folder);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Profile media is served via plain <img src> on public profiles, so the
      // Blob store MUST be a *public* store. A private store rejects access:"public".
      const hint = /private store/i.test(detail)
        ? " — the Blob store is configured as PRIVATE. Profile media must be public: " +
          "create a PUBLIC Vercel Blob store and use its BLOB_READ_WRITE_TOKEN " +
          "(a private store's URLs require auth and won't load in <img>)."
        : "";

      // In production there is no local fallback — surface a clear, actionable error.
      if (process.env.NODE_ENV !== "development") {
        console.error("[storage] Vercel Blob upload failed:", err);
        throw new Error(`Vercel Blob upload failed: ${detail}${hint}`);
      }
      // In development, fall back to the local filesystem but make the cause LOUD
      // so it isn't silently masked (this is why local files land in public/uploads).
      console.warn(
        `[storage] Vercel Blob upload failed${hint || `: ${detail}`}\n` +
        "[storage] Falling back to local public/uploads for THIS dev upload only. " +
        "Production will reject this until the store is fixed."
      );
    }
  }

  // Local filesystem (development)
  if (process.env.NODE_ENV === "development") {
    return localUpload(buffer, fileName, folder);
  }

  throw new StorageNotConfiguredError();
}

/**
 * Delete a previously-uploaded file by its public URL.
 * Silently no-ops for unrecognised URL schemes — never throws.
 */
export async function storageDelete(url: string): Promise<void> {
  // Vercel Blob — delete by full public URL
  if (url.includes(".public.blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
    await blobDel(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }

  // Local filesystem (development only)
  if (url.startsWith("/uploads/") && process.env.NODE_ENV === "development") {
    const rel = url.startsWith("/") ? url.slice(1) : url;
    const localPath = join(process.cwd(), "public", rel);
    await unlink(localPath);
    return;
  }

  // External / OAuth avatar URL — not ours to delete
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

async function localUpload(
  buffer: Buffer,
  fileName: string,
  folder: string
): Promise<UploadedFile> {
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${folder}/${randomUUID()}.${ext}`;
  const absDir = join(process.cwd(), "public", "uploads", folder);
  await mkdir(absDir, { recursive: true });
  await writeFile(join(process.cwd(), "public", "uploads", key), buffer);
  return { url: `/uploads/${key}` };
}

async function vercelBlobUpload(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<UploadedFile> {
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const blob = await put(`${folder}/${randomUUID()}.${ext}`, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });
  return { url: blob.url };
}
