/**
 * Extracted from:
 *   workers/api/src/storage/r2Buckets.ts
 *
 * Why this excerpt matters:
 * - paid users can have data in both shared and dedicated buckets
 * - reads/listing are not a trivial "pick one bucket" decision
 * - upgrade/migration compatibility is handled in code, not hand-waved away
 */

/**
 * Creates a fallback bucket wrapper that checks primary bucket first, then falls back.
 *
 * CRIT-3 FIX (list merge): The list() method now merges results from both buckets,
 * deduplicating by key with preference for primary. This fixes the issue where users
 * with objects in BOTH buckets (post-upgrade scenario) would get incomplete listings.
 *
 * CRIT-5 FIX (delete error propagation): The delete() method now tracks errors from
 * both buckets and throws a combined error if any deletions fail.
 */
export function createFallbackBucket(primary: R2BucketLike, fallback: R2BucketLike): R2BucketLike {
  return {
    async get(key: string, options?: R2GetOptionsLike) {
      try {
        const primaryObj = await primary.get(key, options);
        if (primaryObj) return primaryObj;
      } catch (err) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "r2_fallback_bucket_primary_error",
          operation: "get",
          key,
          error: err instanceof Error ? err.message : String(err),
          message: "Primary bucket get() failed, falling through to fallback",
        }));
      }
      return fallback.get(key, options);
    },
    async list(options?: R2ListOptions) {
      const primaryList = await primary.list(options);
      const fallbackList = await fallback.list(options);

      const objectsByKey = new Map<string, R2ObjectLike>();
      for (const obj of fallbackList.objects) objectsByKey.set(obj.key, obj);
      for (const obj of primaryList.objects) objectsByKey.set(obj.key, obj);

      return {
        objects: Array.from(objectsByKey.values()).sort((a, b) => a.key.localeCompare(b.key)),
        truncated: primaryList.truncated || fallbackList.truncated,
      } as R2Objects;
    },
  };
}

/**
 * Resolves the appropriate R2 bucket for a user based on their plan.
 * For paid users with a dedicated bucket, returns a fallback bucket that checks
 * the user's dedicated bucket first, then falls back to the shared bucket.
 */
async function resolveUserR2Bucket(env: Env, userId: string): Promise<R2BucketLike> {
  const plan = await getEffectivePlanByUserId(env, userId);
  if (!isPaidPlan(plan)) {
    return env.R2;
  }

  const bucketName = await getUserR2BucketName(env, userId);
  if (!bucketName) {
    return env.R2;
  }

  const primary = createR2S3Bucket({
    ...getR2S3Config(env, bucketName),
    maxStreamBodyBytes: PLAN_LIMITS[plan].maxBundleSize,
  });
  return createFallbackBucket(primary, env.R2);
}
