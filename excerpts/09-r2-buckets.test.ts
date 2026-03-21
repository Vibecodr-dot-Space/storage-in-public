/**
 * Extracted from:
 *   workers/api/src/storage/r2Buckets.test.ts
 *
 * Why this excerpt matters:
 * - the awkward fallback behavior is tested directly
 * - the repo is not only comments and architecture prose
 */

describe("createFallbackBucket.list", () => {
  it("merges and prefers primary objects when keys collide", async () => {
    const primary = makeBucket({ "": { objects: [obj("a", 1)], truncated: false } });
    const fallback = makeBucket({ "": { objects: [obj("a", 2), obj("b", 3)], truncated: false } });

    const bucket = createFallbackBucket(primary, fallback);
    const result = await bucket.list({ prefix: "capsules/" });

    expect(result.objects.map((o) => `${o.key}:${o.size}`)).toEqual(["a:1", "b:3"]);
    expect(result.truncated).toBe(false);
  });

  it("CRIT-6: falls through to fallback when primary throws an error", async () => {
    const throwingPrimary: R2BucketLike = {
      async get() { throw new Error("not implemented"); },
      async head() { throw new Error("not implemented"); },
      async put() { throw new Error("not implemented"); },
      async delete() { throw new Error("not implemented"); },
      async list() { throw new Error("S3 API authentication failed"); },
    };
    const fallback = makeBucket({ "": { objects: [obj("a"), obj("b")], truncated: false } });

    const bucket = createFallbackBucket(throwingPrimary, fallback);
    const result = await bucket.list({ prefix: "drafts/" });

    expect(result.objects.map((o) => o.key)).toEqual(["a", "b"]);
    expect(result.truncated).toBe(false);
  });
});
