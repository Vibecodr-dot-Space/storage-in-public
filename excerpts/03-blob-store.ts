/**
 * Extracted from:
 *   workers/api/src/storage/blobStore.ts
 *
 * Why this excerpt matters:
 * - this is where the repo stops being "R2 bucket plus helpers"
 * - it shows the cross-user deduplication decision directly in the source
 */

/**
 * Blob Store - Content-Addressable Storage for Vibecodr
 *
 * WHY: RM-02 Fix - Every remix currently creates a FULL BINARY COPY of all files.
 * A 50MB vibe remixed 1000 times = 50GB of R2 storage.
 *
 * This module implements content-addressable storage with reference counting:
 * - Files are stored in R2 with a `blobs/{hash}/...` prefix
 * - Capsules reference blobs via `capsule_blobs` mapping table
 * - Identical content across capsules shares the same blob (deduplication)
 * - Reference counting enables safe garbage collection
 *
 * BUCKET ARCHITECTURE (Critical Design Decision):
 * - Blobs ALWAYS go to the SHARED bucket (vibecodr-assets), regardless of user plan
 * - This enables cross-user deduplication without cross-user bucket dependencies
 * - Per-user buckets are still used for user-visible assets
 * - Users pay for their LOGICAL storage usage (virtual accounting)
 * - Platform keeps dedup savings as cost reduction
 *
 * WHY NOT PER-USER BUCKETS FOR BLOBS:
 * - Cross-user remix would create dependency on original uploader's bucket
 * - If original uploader deletes account, remix would break
 * - Deduplication only works within same bucket
 * - Virtual accounting solves the "who pays" problem cleanly
 */

function generateBlobR2Key(sha256: string): string {
  return `blobs/${sha256}/${crypto.randomUUID()}`;
}

export async function uploadWithDedup(
  env: Env,
  file: {
    content: ArrayBuffer | Uint8Array | string;
    contentType: string;
    path: string;
  },
  capsuleId: string,
  ownerId: string
): Promise<UploadWithDedupResult> {
  const contentBuffer =
    typeof file.content === "string"
      ? new TextEncoder().encode(file.content).buffer as ArrayBuffer
      : file.content instanceof Uint8Array
        ? file.content.buffer.slice(
            file.content.byteOffset,
            file.content.byteOffset + file.content.byteLength
          ) as ArrayBuffer
        : file.content;

  const sha256 = await generateContentHash(contentBuffer);
  const sizeBytes = contentBuffer.byteLength;

  const existing = await env.DB.prepare(
    "SELECT sha256, size_bytes, ref_count, ref_version FROM blobs WHERE sha256 = ?"
  )
    .bind(sha256)
    .first<{ sha256: string; size_bytes: number; ref_count: number; ref_version: number }>();

  if (existing) {
    return {
      sha256,
      deduplicated: true,
      sizeBytes: existing.size_bytes,
    };
  }

  // ARCHITECTURE: Blobs ALWAYS go to shared bucket, regardless of user plan.
  const bucketName = getSharedR2BucketName(env);
  const r2 = env.R2;
  const r2Key = generateBlobR2Key(sha256);

  await r2.put(r2Key, contentBuffer, {
    httpMetadata: { contentType: file.contentType },
    customMetadata: {
      sha256,
      originalPath: file.path,
      uploadedAt: new Date().toISOString(),
    },
  });

  await env.DB.prepare(
    `INSERT OR IGNORE INTO blobs (sha256, size_bytes, content_type, bucket_name, r2_key, ref_count, ref_version, created_at, last_referenced_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
  )
    .bind(sha256, sizeBytes, file.contentType, bucketName, r2Key, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000))
    .run();

  return { sha256, deduplicated: false, sizeBytes };
}
