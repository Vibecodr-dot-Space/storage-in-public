/**
 * Extracted from:
 *   workers/api/src/storage/r2ObjectIndex.ts
 *
 * Why this excerpt matters:
 * - shows that D1 is the storage control plane
 * - category drives quota and visibility semantics
 * - bucket selection is tied to plan resolution, not hardcoded per route
 */

export type R2ObjectCategory =
  | "avatar"
  | "cover"
  | "thumbnail"
  | "user_asset"
  | "draft"
  | "artifact_bundle"
  | "artifact_source"
  | "artifact_manifest";

export type R2ObjectVisibility = "private" | "public" | "public_cdn";

const QUOTA_CATEGORIES = new Set<R2ObjectCategory>([
  "avatar",
  "cover",
  "thumbnail",
  "user_asset",
  "draft",
  "artifact_bundle",
  "artifact_source",
  // "artifact_manifest" intentionally excluded - system-generated overhead
]);

const PUBLIC_CDN_CATEGORIES = new Set<R2ObjectCategory>(["thumbnail", "user_asset"]);
const PUBLIC_CATEGORIES = new Set<R2ObjectCategory>(["avatar"]);

function countsTowardQuota(category: R2ObjectCategory): boolean {
  return QUOTA_CATEGORIES.has(category);
}

function resolveVisibilityForCategory(category: R2ObjectCategory): R2ObjectVisibility {
  if (PUBLIC_CDN_CATEGORIES.has(category)) return "public_cdn";
  if (PUBLIC_CATEGORIES.has(category)) return "public";
  return "private";
}

/**
 * Resolve the target R2 bucket name for write operations based on user plan.
 *
 * WHY: Free users share a bucket; paid users get isolated storage.
 * This function is on the critical write path and requires full observability.
 */
export async function resolveBucketNameForWrite(env: Env, userId: string): Promise<string> {
  const tracer = createTracer(env, { handler: "r2ObjectIndex.resolveBucketNameForWrite" });

  return tracer.span("resolveBucketNameForWrite", async (span) => {
    const plan = await getEffectivePlanByUserId(env, userId);
    span.setAttribute("plan", plan);

    if (plan === Plan.FREE) {
      return getSharedR2BucketName(env);
    }

    return ensureUserR2BucketName(env, userId);
  });
}
