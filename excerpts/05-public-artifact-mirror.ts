/**
 * Extracted from:
 *   workers/api/src/runtime/publicArtifactMirror.ts
 *
 * Why this excerpt matters:
 * - public runtime delivery is a mirror flow, not direct access to canonical artifacts
 * - publish configuration is a hard precondition, not an implicit assumption
 * - access policy is checked before mirroring, after lease claim, and again before commit
 * - a D1 lease plus a sentinel manifest copy make the process observable and idempotent
 * - stale mirrored launches can be detected and repaired through the launch contract path
 */

export type PublicArtifactMirrorResult = {
  ok: boolean;
  mirrored: boolean;
  reason: string;
};

type AnonymousArtifactViewer = {
  viewerId: null;
  isAuthenticated: false;
  isMod: false;
};

const ANONYMOUS_ARTIFACT_VIEWER: AnonymousArtifactViewer = {
  viewerId: null,
  isAuthenticated: false,
  isMod: false,
};

const MIRROR_COPY_CONCURRENCY = 6;
const MIRROR_LEASE_TTL_SECONDS = 60;
const mirrorTasksInFlight = new Map<string, Promise<PublicArtifactMirrorResult>>();

function hasMirrorStorage(env: Env): env is Env & { PUBLIC_ARTIFACTS: R2Bucket } {
  return Boolean(env.PUBLIC_ARTIFACTS);
}

function isPublishConfigured(env: Env): env is Env & { PUBLIC_ARTIFACTS: R2Bucket } {
  return Boolean(
    env.PUBLIC_ARTIFACTS &&
      env.ARTIFACT_PUBLIC_ASSETS_ORIGIN?.trim() &&
      isArtifactCachePurgeEnabled(env)
  );
}

export function isArtifactScopedKey(
  artifactId: string,
  key: string | null | undefined
): key is string {
  return (
    typeof key === "string" &&
    key.startsWith(`artifacts/${artifactId}/`) &&
    !key.startsWith("/") &&
    !key.includes("\\")
  );
}

function buildArtifactPublicDeleteTargets(
  artifactId: string,
  bundleKey: string | null | undefined
): {
  directKeys: string[];
  bundlePrefix: string;
} {
  const directKeys = new Set<string>([
    runtimeManifestKeys.artifactRuntimeManifestJson(artifactId),
    runtimeManifestKeys.artifactManifestCopyJson(artifactId),
    runtimeManifestKeys.artifactBundleJs(artifactId),
    runtimeManifestKeys.artifactBundleTs(artifactId),
  ]);
  if (isArtifactScopedKey(artifactId, bundleKey)) {
    directKeys.add(bundleKey);
  }
  return {
    directKeys: Array.from(directKeys),
    bundlePrefix: runtimeManifestKeys.artifactBundleBase(artifactId),
  };
}

export async function listPublicArtifactMirrorKeys(
  env: Env,
  args: {
    artifactId: string;
    bundleKey?: string | null;
  }
): Promise<string[]> {
  if (!hasMirrorStorage(env)) return [];

  const targets = buildArtifactPublicDeleteTargets(args.artifactId, args.bundleKey);
  const listed = await r2ListAll(env.PUBLIC_ARTIFACTS, targets.bundlePrefix);
  return Array.from(new Set<string>([...targets.directKeys, ...listed.objects.map((object) => object.key)]));
}

function buildPutOptions(sourceObject: R2ObjectBodyLike): R2PutOptions {
  return {
    ...(sourceObject.httpMetadata ? { httpMetadata: sourceObject.httpMetadata } : {}),
    ...(sourceObject.customMetadata ? { customMetadata: sourceObject.customMetadata } : {}),
  };
}

async function copyKeyIfMissing(source: R2BucketLike, dest: R2BucketLike, key: string): Promise<void> {
  const existing = await dest.head(key);
  if (existing) return;

  const sourceObject = await source.get(key);
  if (!sourceObject?.body) {
    throw new Error(`source_missing:${key}`);
  }

  await dest.put(key, sourceObject.body, buildPutOptions(sourceObject));
}

async function mirrorBundleObjects(
  source: R2BucketLike,
  dest: R2BucketLike,
  artifactId: string,
  bundleKey: string
): Promise<void> {
  const bundlePrefix = runtimeManifestKeys.artifactBundleBase(artifactId);
  const keys = bundleKey.startsWith(bundlePrefix)
    ? (await r2ListAll(source, bundlePrefix)).objects.map((object) => object.key)
    : [bundleKey];

  for (let index = 0; index < keys.length; index += MIRROR_COPY_CONCURRENCY) {
    const batch = keys.slice(index, index + MIRROR_COPY_CONCURRENCY);
    await Promise.all(batch.map((key) => copyKeyIfMissing(source, dest, key)));
  }
}

async function resolveArtifactSourceBucket(
  env: Env,
  ownerId: string | null | undefined
): Promise<R2BucketLike> {
  if (!ownerId) return env.R2;
  return getUserR2BucketForRead(env, ownerId);
}

async function tryClaimPublicArtifactMirrorLease(
  env: Env,
  artifactId: string
): Promise<"claimed" | "busy" | "unavailable"> {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    return "unavailable";
  }

  const now = Math.floor(Date.now() / 1000);
  const leaseUntil = now + MIRROR_LEASE_TTL_SECONDS;
  try {
    const result = await env.DB.prepare(
      `/* claim public artifact mirror lease when the current lease is expired */`
    )
      .bind(artifactId, leaseUntil, now)
      .run();
    return Number(result?.meta?.changes ?? 0) > 0 ? "claimed" : "busy";
  } catch (error) {
    console.warn("PUBLIC_ARTIFACT_MIRROR_LEASE_FAILED", {
      artifactId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "unavailable";
  }
}

async function releasePublicArtifactMirrorLease(env: Env, artifactId: string): Promise<void> {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    return;
  }

  try {
    await env.DB.prepare("/* release public artifact mirror lease */")
      .bind(artifactId)
      .run();
  } catch (error) {
    console.warn("PUBLIC_ARTIFACT_MIRROR_LEASE_RELEASE_FAILED", {
      artifactId,
      error: error instanceof Error ? error.message : String(error),
    });
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
  if (existingTask) {
    return existingTask;
  }

  const task = (async (): Promise<PublicArtifactMirrorResult> => {
    if (!isPublishConfigured(env)) {
      return { ok: false, mirrored: false, reason: "mirror_unconfigured" };
    }

    const loadPublicDecision = async (): Promise<
      | { ok: true }
      | { ok: false; reason: "artifact_not_found" | "not_publicly_cacheable" }
    > => {
      const accessSnapshot = await loadArtifactAccessSnapshot(env, args.artifactId);
      if (!accessSnapshot) {
        return { ok: false, reason: "artifact_not_found" };
      }
      const publicDecision = evaluateArtifactAccessPolicy(
        accessSnapshot,
        ANONYMOUS_ARTIFACT_VIEWER
      );
      if (!publicDecision.allowed) {
        return { ok: false, reason: "not_publicly_cacheable" };
      }
      return { ok: true };
    };

    const initialDecision = await loadPublicDecision();
    if (!initialDecision.ok) {
      return { ok: false, mirrored: false, reason: initialDecision.reason };
    }

    const bundleKey = args.manifest.bundle?.r2Key;
    if (!isArtifactScopedKey(args.artifactId, bundleKey)) {
      return { ok: false, mirrored: false, reason: "bundle_not_mirrorable" };
    }

    // NOTE: This sentinel is intentionally advisory only. Concurrent requests for
    // the same artifact can both proceed and double-write identical content.
    const manifestCopyKey = runtimeManifestKeys.artifactManifestCopyJson(args.artifactId);
    const alreadyMirrored = await env.PUBLIC_ARTIFACTS.head(manifestCopyKey);
    if (alreadyMirrored) {
      const launchContractReady = await isPublicArtifactMirrorReady(env, args.artifactId, {
        requireLaunchContract: true,
      });
      if (launchContractReady || !args.manifest.launch) {
        return { ok: true, mirrored: false, reason: "already_mirrored" };
      }
    }

    const leaseState = await tryClaimPublicArtifactMirrorLease(env, args.artifactId);
    if (leaseState === "busy") {
      return { ok: false, mirrored: false, reason: "mirror_in_progress" };
    }

    try {
      const freshDecision = await loadPublicDecision();
      if (!freshDecision.ok) {
        return { ok: false, mirrored: false, reason: freshDecision.reason };
      }

      const sourceBucket = await resolveArtifactSourceBucket(env, args.ownerId);
      await mirrorBundleObjects(sourceBucket, env.PUBLIC_ARTIFACTS, args.artifactId, bundleKey);

      const finalDecision = await loadPublicDecision();
      if (!finalDecision.ok) {
        await deletePublicArtifactMirror(env, {
          artifactId: args.artifactId,
          bundleKey,
        });
        return { ok: false, mirrored: false, reason: finalDecision.reason };
      }

      const manifestJson = JSON.stringify(args.manifest);
      const manifestPutOptions: R2PutOptions = {
        httpMetadata: {
          contentType: "application/json",
          cacheControl: "public, max-age=30",
        },
      };

      await env.PUBLIC_ARTIFACTS.put(
        runtimeManifestKeys.artifactRuntimeManifestJson(args.artifactId),
        manifestJson,
        manifestPutOptions
      );

      // Write the non-versioned manifest last. Its presence is the "mirror complete" sentinel.
      await env.PUBLIC_ARTIFACTS.put(manifestCopyKey, manifestJson, manifestPutOptions);
      return { ok: true, mirrored: true, reason: "mirrored" };
    } finally {
      if (leaseState === "claimed") {
        await releasePublicArtifactMirrorLease(env, args.artifactId);
      }
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

export async function deletePublicArtifactMirror(
  env: Env,
  args: {
    artifactId: string;
    bundleKey?: string | null;
  }
): Promise<void> {
  if (!hasMirrorStorage(env)) return;

  const keys = await listPublicArtifactMirrorKeys(env, args);
  await Promise.all(Array.from(keys, (key) => env.PUBLIC_ARTIFACTS.delete(key)));
}

export async function isPublicArtifactMirrorReady(
  env: Env,
  artifactId: string,
  options?: { requireLaunchContract?: boolean }
): Promise<boolean> {
  if (!hasMirrorStorage(env)) return false;
  const sentinelKey = runtimeManifestKeys.artifactManifestCopyJson(artifactId);
  if (options?.requireLaunchContract !== true) {
    const manifestCopy = await env.PUBLIC_ARTIFACTS.head(sentinelKey);
    return Boolean(manifestCopy);
  }

  const manifestCopy = await env.PUBLIC_ARTIFACTS.get(sentinelKey);
  if (!manifestCopy) {
    return false;
  }

  try {
    const manifest = (await manifestCopy.json()) as Partial<RuntimeManifest>;
    return Boolean(manifest.launch);
  } catch {
    return false;
  }
}
