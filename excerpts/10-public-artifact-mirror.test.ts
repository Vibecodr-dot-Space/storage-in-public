/**
 * Extracted from:
 *   workers/api/src/runtime/publicArtifactMirror.test.ts
 *
 * Why this excerpt matters:
 * - the public mirror flow has explicit tests
 * - the tests model the bucket behavior in memory rather than hand-waving the critical path
 */

describe("publicArtifactMirror", () => {
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

    const manifest = {
      artifactId: "art-1",
      type: "html",
      bundle: {
        r2Key: "artifacts/art-1/bundle/index.html",
      },
      runtime: {
        version: "test",
      },
    } as RuntimeManifest;

    const result = await ensurePublicArtifactMirror(env, {
      artifactId: "art-1",
      ownerId: "owner-1",
      manifest,
    });

    expect(result).toEqual({
      ok: false,
      mirrored: false,
      reason: "not_publicly_cacheable",
    });
  });
});
