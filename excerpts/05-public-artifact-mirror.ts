/**
 * Extracted from:
 *   workers/api/src/runtime/publicArtifactMirror.ts
 *
 * Why this excerpt matters:
 * - public runtime delivery is a mirror flow, not direct access to canonical artifacts
 * - access policy is checked before and after mirroring
 * - a D1 lease and a sentinel manifest copy make the process observable and idempotent
 */

const MIRROR_COPY_CONCURRENCY = 6;
const MIRROR_LEASE_TTL_SECONDS = 60;
const mirrorTasksInFlight = new Map<string, Promise<PublicArtifactMirrorResult>>();

async function tryClaimPublicArtifactMirrorLease(
  env: Env,
  artifactId: string
): Promise<"claimed" | "busy" | "unavailable"> {
  const now = Math.floor(Date.now() / 1000);
  const leaseUntil = now + MIRROR_LEASE_TTL_SECONDS;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO public_artifact_mirror_leases (artifact_id, lease_expires_at, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(artifact_id) DO UPDATE SET
         lease_expires_at = excluded.lease_expires_at,
         updated_at = excluded.updated_at
       WHERE public_artifact_mirror_leases.lease_expires_at <= excluded.updated_at`
    )
      .bind(artifactId, leaseUntil, now)
      .run();
    return Number(result?.meta?.changes ?? 0) > 0 ? "claimed" : "busy";
  } catch {
    return "unavailable";
  }
}

export async function ensurePublicArtifactMirror(
  env: Env,
  args: {
    artifactId: string;
    ownerId?: string | null;
    manifest: RuntimeManifest;
  }
): Promise<PublicArtifactMirrorResult> {
  const existingTask = mirrorTasksInFlight.get(args.artifactId);
  if (existingTask) return existingTask;

  const task = (async (): Promise<PublicArtifactMirrorResult> => {
    const accessSnapshot = await loadArtifactAccessSnapshot(env, args.artifactId);
    const publicDecision = accessSnapshot
      ? evaluateArtifactAccessPolicy(accessSnapshot, {
          viewerId: null,
          isAuthenticated: false,
          isMod: false,
        })
      : { allowed: false };

    if (!publicDecision.allowed) {
      return { ok: false, mirrored: false, reason: "not_publicly_cacheable" };
    }

    const bundleKey = args.manifest.bundle?.r2Key;
    if (!bundleKey?.startsWith(`artifacts/${args.artifactId}/`)) {
      return { ok: false, mirrored: false, reason: "bundle_not_mirrorable" };
    }

    const manifestCopyKey = runtimeManifestKeys.artifactManifestCopyJson(args.artifactId);
    const alreadyMirrored = await env.PUBLIC_ARTIFACTS.head(manifestCopyKey);
    if (alreadyMirrored) {
      return { ok: true, mirrored: false, reason: "already_mirrored" };
    }

    const leaseState = await tryClaimPublicArtifactMirrorLease(env, args.artifactId);
    if (leaseState === "busy") {
      return { ok: false, mirrored: false, reason: "mirror_in_progress" };
    }

    try {
      const sourceBucket = args.ownerId ? await getUserR2BucketForRead(env, args.ownerId) : env.R2;
      const bundlePrefix = runtimeManifestKeys.artifactBundleBase(args.artifactId);
      const keys = (await r2ListAll(sourceBucket, bundlePrefix)).objects.map((object) => object.key);

      for (let index = 0; index < keys.length; index += MIRROR_COPY_CONCURRENCY) {
        const batch = keys.slice(index, index + MIRROR_COPY_CONCURRENCY);
        await Promise.all(batch.map(async (key) => {
          const existing = await env.PUBLIC_ARTIFACTS.head(key);
          if (existing) return;
          const sourceObject = await sourceBucket.get(key);
          if (!sourceObject?.body) throw new Error(`source_missing:${key}`);
          await env.PUBLIC_ARTIFACTS.put(key, sourceObject.body, {
            ...(sourceObject.httpMetadata ? { httpMetadata: sourceObject.httpMetadata } : {}),
            ...(sourceObject.customMetadata ? { customMetadata: sourceObject.customMetadata } : {}),
          });
        }));
      }

      const manifestJson = JSON.stringify(args.manifest);

      await env.PUBLIC_ARTIFACTS.put(
        runtimeManifestKeys.artifactRuntimeManifestJson(args.artifactId),
        manifestJson,
        { httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=30" } }
      );

      // Write the non-versioned manifest last. Its presence is the "mirror complete" sentinel.
      await env.PUBLIC_ARTIFACTS.put(
        manifestCopyKey,
        manifestJson,
        { httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=30" } }
      );

      return { ok: true, mirrored: true, reason: "mirrored" };
    } finally {
      await env.DB.prepare("DELETE FROM public_artifact_mirror_leases WHERE artifact_id = ?")
        .bind(args.artifactId)
        .run();
    }
  })();

  mirrorTasksInFlight.set(args.artifactId, task);
  try {
    return await task;
  } finally {
    if (mirrorTasksInFlight.get(args.artifactId) === task) {
      mirrorTasksInFlight.delete(args.artifactId);
    }
  }
}
