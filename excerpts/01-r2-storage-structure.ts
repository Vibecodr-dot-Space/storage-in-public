/**
 * Extracted from:
 *   workers/api/src/storage/r2.ts
 *
 * Why this excerpt matters:
 * - shows that the storage layout changed after a real collision/data-loss issue
 * - shows that lifecycle policy is explicit, not implied
 * - shows that the code carries memory and scanning constraints, not just key names
 */

/**
 * R2 Storage Structure:
 *
 * CRITICAL FIX (2025-12-19): Changed from contentHash to capsuleId for storage keys.
 * WHY: Content-addressable storage caused collision bugs - if two users uploaded
 * identical content (e.g., starter template), they shared the same R2 key, and
 * one user's upload could overwrite another's files. This caused DATA LOSS.
 *
 * NEW STRUCTURE (capsuleId-based - SAFE):
 * capsules/{capsuleId}/
 *   ├── manifest.json
 *   ├── {entryFile}
 *   ├── assets/...
 *   └── metadata.json
 *
 * LEGACY STRUCTURE (contentHash-based - DO NOT USE FOR NEW UPLOADS):
 * capsules/{contentHash}/
 *   - Old capsules may still use this format
 *   - Read operations check both locations for backward compat
 *
 * drafts/{userId}/{draftId}/
 *   LIFECYCLE: RETAINED - never automatically deleted by background jobs.
 *
 * avatars/{userId}/{avatarId}.{ext}
 *   LIFECYCLE: Keep only current avatar per user; orphans cleaned daily
 *
 * thumbnails/{postId}/{thumbId}.jpeg
 *   LIFECYCLE: Expire after 90 days if not referenced by posts.cover_key
 *
 * artifacts/{artifactId}/v{version}/
 *   ├── sources.tar
 *   └── bundle/
 *   LIFECYCLE: INTENTIONALLY PERMANENT - Immutable runtime bundles.
 */

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".css",
  ".json",
  ".svg",
  ".xml",
  ".txt",
  ".md",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".sh",
  ".bash",
  ".ps1",
  ".bat",
  ".cmd",
]);

export const TEXT_FILE_MEMORY_BUDGET = 50 * 1024 * 1024; // 50MB
export const TEXT_FILE_COUNT_LIMIT = 5000;
