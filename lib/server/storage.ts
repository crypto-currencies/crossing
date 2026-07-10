/**
 * Centralized profile-asset storage abstraction.
 *
 * All upload / delete / validate operations for user-generated media go through
 * this module. The underlying provider (Vercel Blob in production, local FS in
 * development) is handled by lib/storage.ts. Swap providers there without
 * touching any route or component.
 *
 * Env vars required for production:
 *   BLOB_READ_WRITE_TOKEN  — Vercel Blob read-write token
 *
 * Supported asset types and their limits:
 *   avatar          5 MB   JPEG / PNG / WebP
 *   banner          10 MB  JPEG / PNG / WebP / GIF
 *   background      10 MB  JPEG / PNG / WebP / GIF  (video → 25 MB)
 *                   25 MB  MP4 / WebM
 *   musicArtwork    5 MB   JPEG / PNG / WebP
 *   collectionCover 10 MB  JPEG / PNG / WebP / GIF
 *   music           30 MB  MP3 / WAV / OGG / M4A / AAC (audio only)
 */

import {
  storageConfigured,
  storageUpload,
  storageDelete,
  StorageNotConfiguredError,
} from "@/lib/storage";

// ─── Asset types ──────────────────────────────────────────────────────────────

export type AssetType =
  | "avatar"
  | "banner"
  | "background"
  | "musicArtwork"
  | "collectionCover"
  | "music";

// ─── Constraints ──────────────────────────────────────────────────────────────

const AUDIO_MIMES = [
  // MP3 — Chrome/Firefox use audio/mpeg; Safari may report audio/mp3
  "audio/mpeg",
  "audio/mp3",
  // WAV
  "audio/wav",
  "audio/wave",
  // OGG
  "audio/ogg",
  // M4A / AAC — Chrome: audio/x-m4a, Firefox: audio/mp4
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
] as const;

const VIDEO_MIMES = ["video/mp4", "video/webm"] as const;

interface AssetConstraint {
  mimes: readonly string[];
  maxMB: number;
  /** Only used for the "background" type: max size when the file is a video. */
  videoMaxMB?: number;
}

export const ASSET_CONSTRAINTS: Record<AssetType, AssetConstraint> = {
  avatar: {
    maxMB: 5,
    mimes: ["image/jpeg", "image/png", "image/webp"],
  },
  banner: {
    maxMB: 10,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  background: {
    maxMB: 10,
    videoMaxMB: 25,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
  },
  musicArtwork: {
    maxMB: 5,
    mimes: ["image/jpeg", "image/png", "image/webp"],
  },
  collectionCover: {
    maxMB: 10,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  music: {
    maxMB: 30,
    mimes: [...AUDIO_MIMES],
  },
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates MIME type and file size for the given asset type.
 * Returns a user-facing error string, or null if the file is valid.
 */
export function validateProfileAsset(
  mimeType: string,
  fileSize: number,
  assetType: AssetType,
): string | null {
  const c = ASSET_CONSTRAINTS[assetType];
  const isAudio = assetType === "music";

  // MIME allowlist — strict; audio gets a loose audio/* fallback for obscure
  // browser-reported variants (e.g. "audio/x-wav").
  const mimeOk =
    (c.mimes as string[]).includes(mimeType) ||
    (isAudio && mimeType.startsWith("audio/"));

  if (!mimeOk) {
    const labels = [
      ...new Set((c.mimes as string[]).map((m) => m.split("/")[1].toUpperCase())),
    ].join(", ");
    return `Unsupported file type. Allowed: ${labels}`;
  }

  // Size limit — background videos use a higher cap than background images
  const isVideo = (VIDEO_MIMES as readonly string[]).includes(mimeType);
  const maxMB =
    assetType === "background" && isVideo && c.videoMaxMB
      ? c.videoMaxMB
      : c.maxMB;

  if (fileSize > maxMB * 1024 * 1024) {
    return `File too large — max ${maxMB}MB`;
  }

  return null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  /** Publicly accessible URL stored in the database. */
  url: string;
}

/**
 * Uploads a file buffer to the configured storage provider.
 * Throws StorageNotConfiguredError if no provider is available.
 * Call validateProfileAsset first — this function does not re-validate.
 */
export async function uploadProfileAsset(
  userId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  assetType: AssetType,
): Promise<UploadResult> {
  if (!storageConfigured()) throw new StorageNotConfiguredError();
  const folder = `profiles/${userId}/${assetType}`;
  return storageUpload(buffer, fileName, mimeType, folder);
}

// ─── Deletion ─────────────────────────────────────────────────────────────────

/**
 * Deletes a previously-uploaded asset from storage.
 * Only acts on URLs this app manages (Vercel Blob or local /uploads/).
 * Always resolves — deletion failures are logged but never re-thrown, so a
 * failed cleanup never blocks the caller's response.
 */
export async function deleteProfileAsset(
  url: string | null | undefined,
): Promise<void> {
  if (!url || !isManagedStorageUrl(url)) return;
  try {
    await storageDelete(url);
  } catch (err) {
    console.error("[storage] deleteProfileAsset failed (non-fatal):", err);
  }
}

/**
 * Returns true only for URLs produced by this app's storage layer.
 * OAuth avatar URLs (Discord, GitHub …) return false and are left untouched.
 */
export function isManagedStorageUrl(url: string): boolean {
  return (
    url.startsWith("/uploads/") ||
    url.includes(".public.blob.vercel-storage.com")
  );
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export { storageConfigured, StorageNotConfiguredError };
