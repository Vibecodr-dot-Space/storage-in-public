# Excerpts

These files are the center of the repo.

They are not fictional examples. They are curated excerpts from the real Vibecodr production storage code, trimmed for clarity and safety.

Each file keeps the original path in a header comment so readers can see what kind of module it came from.

## Suggested Order

If you want the current contract first, read these two before anything else:

1. [11-source-access.ts](./11-source-access.ts)
2. [12-authored-layout.ts](./12-authored-layout.ts)

Then read the long-lived storage foundation:

3. [05-public-artifact-mirror.ts](./05-public-artifact-mirror.ts)
4. [08-storage-schema.ts](./08-storage-schema.ts)
5. [01-r2-storage-structure.ts](./01-r2-storage-structure.ts)
6. [02-r2-buckets-fallback.ts](./02-r2-buckets-fallback.ts)
7. [03-blob-store.ts](./03-blob-store.ts)
8. [04-r2-object-index.ts](./04-r2-object-index.ts)
9. [06-file-serving-security.ts](./06-file-serving-security.ts)
10. [09-r2-buckets.test.ts](./09-r2-buckets.test.ts)
11. [10-public-artifact-mirror.test.ts](./10-public-artifact-mirror.test.ts)

## What To Look For

- the SSOT owners that now separate read intent, authored write intent, public mirror eligibility, and legacy self-heal
- compatibility and fallback paths that only appear in a real long-lived product
- tests around the uncomfortable edge cases
- schema shapes that make the control plane visible
