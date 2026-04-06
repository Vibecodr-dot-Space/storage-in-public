/**
 * Extracted from:
 *   workers/api/src/runtime/publicArtifactMirror.test.ts
 *
 * Why this excerpt matters:
 * - the public mirror flow has explicit tests
 * - the tests cover policy re-checks, cleanup on stale access, lease backoff, and launch freshness
 * - the bucket behavior is modeled in memory instead of hand-waving the critical path
 */

describe("publicArtifactMirror", () => {
  beforeEach(() => {
    artifactAccessPolicyMocks.loadArtifactAccessSnapshot.mockReset();
    artifactAccessPolicyMocks.evaluateArtifactAccessPolicy.mockReset();
    artifactAccessPolicyMocks.loadArtifactAccessSnapshot.mockResolvedValue({
      artifact: {
        id: "art-1",
        capsule_id: "cap-1",
        owner_id: "owner-1",
        status: "active",
        policy_status: "active",
        visibility: "public",
      },
      capsule: {
        id: "cap-1",
        owner_id: "owner-1",
        publish_state: "published",
        quarantined: 0,
        embed_allowed_origins: null,
      },
      postStats: {
        hasPublicPost: true,
        hasUnlistedPost: false,
      },
    });
    artifactAccessPolicyMocks.evaluateArtifactAccessPolicy.mockReturnValue({
      allowed: true,
      viewerIsOwner: false,
      viewerIsMod: false,
      capsulePublishState: "published",
      effectiveVisibility: "public",
      decisionId: "allow:test",
      reason: "test",
    });
  });

  it("re-checks public access after the sentinel miss before writing mirrored objects", async () => {
    const env = makeEnv();
    const source = env.R2 as unknown as MemoryR2Bucket;
    await source.put("artifacts/art-1/bundle/index.html", "<html></html>", {
      httpMetadata: { contentType: "text/html" },
    });

    const decisionSequence = [
      { allowed: true, decisionId: "allow:initial" },
      { allowed: false, decisionId: "deny:recheck" },
    ];
    artifactAccessPolicyMocks.evaluateArtifactAccessPolicy.mockImplementation(() => {
      const next = decisionSequence.shift();
      return {
        viewerIsOwner: false,
        viewerIsMod: false,
        capsulePublishState: "published",
        effectiveVisibility: "public",
        reason: "test",
        ...(next ?? { allowed: false, decisionId: "deny:default" }),
      };
    });

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      ownerId: "owner-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_publicly_cacheable");
  });

  it("mirrors bundle assets and manifest copies into the public artifact bucket", async () => {
    const env = makeEnv();
    const source = env.R2 as unknown as MemoryR2Bucket;
    await source.put("artifacts/art-1/bundle/index.html", "<html></html>", {
      httpMetadata: { contentType: "text/html" },
    });
    await source.put("artifacts/art-1/bundle/app.js", "console.log('ok')", {
      httpMetadata: { contentType: "application/javascript" },
    });

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
          files: [{ path: "index.html", contentType: "text/html", sizeBytes: 12 }],
        },
      },
    });

    expect(result.ok).toBe(true);
    const publicBucket = env.PUBLIC_ARTIFACTS as unknown as MemoryR2Bucket;
    expect(publicBucket.objects.has("artifacts/art-1/bundle/index.html")).toBe(true);
    expect(publicBucket.objects.has("artifacts/art-1/bundle/app.js")).toBe(true);
    expect(publicBucket.objects.has("artifacts/art-1/v1/runtime-manifest.json")).toBe(true);
    expect(publicBucket.objects.has("artifacts/art-1/manifest.json")).toBe(true);
  });

  it("cleans up copied bundle objects if access flips private during the copy window", async () => {
    const env = makeEnv();
    const source = env.R2 as unknown as MemoryR2Bucket;
    await source.put("artifacts/art-1/bundle/index.html", "<html></html>", {
      httpMetadata: { contentType: "text/html" },
    });
    await source.put("artifacts/art-1/bundle/app.js", "console.log('ok')", {
      httpMetadata: { contentType: "application/javascript" },
    });

    artifactAccessPolicyMocks.loadArtifactAccessSnapshot
      .mockResolvedValueOnce({
        artifact: {
          id: "art-1",
          capsule_id: "cap-1",
          owner_id: "owner-1",
          status: "active",
          policy_status: "active",
          visibility: "public",
        },
        capsule: {
          id: "cap-1",
          owner_id: "owner-1",
          publish_state: "published",
          quarantined: 0,
          embed_allowed_origins: null,
        },
        postStats: {
          hasPublicPost: true,
          hasUnlistedPost: false,
        },
      })
      .mockResolvedValueOnce({
        artifact: {
          id: "art-1",
          capsule_id: "cap-1",
          owner_id: "owner-1",
          status: "active",
          policy_status: "active",
          visibility: "public",
        },
        capsule: {
          id: "cap-1",
          owner_id: "owner-1",
          publish_state: "published",
          quarantined: 0,
          embed_allowed_origins: null,
        },
        postStats: {
          hasPublicPost: true,
          hasUnlistedPost: false,
        },
      })
      .mockResolvedValueOnce({
        artifact: {
          id: "art-1",
          capsule_id: "cap-1",
          owner_id: "owner-1",
          status: "active",
          policy_status: "active",
          visibility: "private",
        },
        capsule: {
          id: "cap-1",
          owner_id: "owner-1",
          publish_state: "published",
          quarantined: 0,
          embed_allowed_origins: null,
        },
        postStats: {
          hasPublicPost: true,
          hasUnlistedPost: false,
        },
      });
    artifactAccessPolicyMocks.evaluateArtifactAccessPolicy
      .mockReturnValueOnce({
        allowed: true,
        viewerIsOwner: false,
        viewerIsMod: false,
        capsulePublishState: "published",
        effectiveVisibility: "public",
        decisionId: "allow:test",
        reason: "test",
      })
      .mockReturnValueOnce({
        allowed: true,
        viewerIsOwner: false,
        viewerIsMod: false,
        capsulePublishState: "published",
        effectiveVisibility: "public",
        decisionId: "allow:test",
        reason: "test",
      })
      .mockReturnValueOnce({
        allowed: false,
        viewerIsOwner: false,
        viewerIsMod: false,
        capsulePublishState: "published",
        effectiveVisibility: "private",
        decisionId: "deny:test",
        reason: "test",
      });

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
          files: [
            { path: "index.html", contentType: "text/html", sizeBytes: 12 },
            { path: "app.js", contentType: "application/javascript", sizeBytes: 16 },
          ],
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_publicly_cacheable");
    const publicBucket = env.PUBLIC_ARTIFACTS as unknown as MemoryR2Bucket;
    expect(publicBucket.objects.size).toBe(0);
  });

  it("deletes mirrored bundle and manifest objects", async () => {
    const env = makeEnv();
    const publicBucket = env.PUBLIC_ARTIFACTS as unknown as MemoryR2Bucket;
    await publicBucket.put("artifacts/art-1/bundle/index.html", "<html></html>");
    await publicBucket.put("artifacts/art-1/bundle/app.js", "console.log('ok')");
    await publicBucket.put("artifacts/art-1/v1/runtime-manifest.json", "{}");
    await publicBucket.put("artifacts/art-1/manifest.json", "{}");

    const keysBefore = await listPublicArtifactMirrorKeys(env, {
      artifactId: "art-1",
      bundleKey: "artifacts/art-1/bundle/index.html",
    });
    expect(keysBefore).toContain("artifacts/art-1/manifest.json");

    await deletePublicArtifactMirror(env, {
      artifactId: "art-1",
      bundleKey: "artifacts/art-1/bundle/index.html",
    });

    expect(publicBucket.objects.size).toBe(0);
  });

  it("still deletes mirrored objects when purge capability is temporarily unavailable", async () => {
    const env = makeEnv();
    const publicBucket = env.PUBLIC_ARTIFACTS as unknown as MemoryR2Bucket;
    await publicBucket.put("artifacts/art-1/bundle/index.html", "<html></html>");
    await publicBucket.put("artifacts/art-1/v1/runtime-manifest.json", "{}");
    await publicBucket.put("artifacts/art-1/manifest.json", "{}");
    delete env.CACHE_PURGE_TOKEN;
    delete env.CF_ZONE_ID;

    const keysBefore = await listPublicArtifactMirrorKeys(env, {
      artifactId: "art-1",
      bundleKey: "artifacts/art-1/bundle/index.html",
    });
    expect(keysBefore).toContain("artifacts/art-1/manifest.json");

    await deletePublicArtifactMirror(env, {
      artifactId: "art-1",
      bundleKey: "artifacts/art-1/bundle/index.html",
    });

    expect(publicBucket.objects.size).toBe(0);
  });

  it("refuses to mirror non-artifact scoped bundle keys", async () => {
    const env = makeEnv();
    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "react-jsx",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "react-runtime.js" },
          },
        },
        bundle: {
          r2Key: "capsules/hash/index.js",
          sizeBytes: 12,
          digest: "digest-1",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bundle_not_mirrorable");
  });

  it("disables the public mirror path when cache purge capability is absent", async () => {
    const env = makeEnv();
    delete env.CACHE_PURGE_TOKEN;
    delete env.CF_ZONE_ID;

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("mirror_unconfigured");
  });

  it("backs off when another isolate already holds the mirror lease", async () => {
    const env = makeEnv();
    env.DB = {
      prepare: vi.fn((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn(async () => ({ meta: { changes: 0 } })),
      })),
    } as unknown as D1Database;

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("mirror_in_progress");
  });

  it("treats a mirrored manifest without launch metadata as stale when launch contracts are required", async () => {
    const env = makeEnv();
    const publicBucket = env.PUBLIC_ARTIFACTS as R2Bucket;
    await publicBucket.put(
      "artifacts/art-1/manifest.json",
      JSON.stringify({ artifactId: "art-1", type: "react-jsx" }),
      {
        httpMetadata: { contentType: "application/json" },
      }
    );

    await expect(isPublicArtifactMirrorReady(env, "art-1")).resolves.toBe(true);
    await expect(
      isPublicArtifactMirrorReady(env, "art-1", { requireLaunchContract: true })
    ).resolves.toBe(false);
  });

  it("refreshes stale mirrored manifests that predate launch contracts", async () => {
    const env = makeEnv();
    const source = env.R2 as unknown as MemoryR2Bucket;
    await source.put("artifacts/art-1/bundle/index.html", "<html></html>", {
      httpMetadata: { contentType: "text/html" },
    });

    const publicBucket = env.PUBLIC_ARTIFACTS as unknown as MemoryR2Bucket;
    await publicBucket.put(
      "artifacts/art-1/manifest.json",
      JSON.stringify({ artifactId: "art-1", type: "html" }),
      {
        httpMetadata: { contentType: "application/json" },
      }
    );

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      manifest: {
        artifactId: "art-1",
        type: "html",
        launch: {
          version: 1,
          profile: "instant",
          supportsWarmShell: true,
          supportsDeferredBundleLoad: false,
          budgets: {
            shellReadyTargetMs: 250,
            interactiveReadyWarnMs: 450,
            interactiveReadyTimeoutMs: 1800,
          },
        },
        runtime: {
          version: "1",
          assets: {
            bridge: { path: "bridge.js" },
            guard: { path: "guard.js" },
            runtimeScript: { path: "html-runtime.js" },
          },
        },
        bundle: {
          r2Key: "artifacts/art-1/bundle/index.html",
          sizeBytes: 12,
          digest: "digest-1",
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.mirrored).toBe(true);
    const refreshedManifest = await publicBucket.get("artifacts/art-1/manifest.json");
    await expect(refreshedManifest?.json()).resolves.toMatchObject({
      artifactId: "art-1",
      launch: {
        profile: "instant",
      },
    });
  });
});
