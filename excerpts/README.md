# Excerpts

These files are the center of the repo.

They are not fictional examples. They are curated excerpts from the real Vibecodr production storage code, trimmed for clarity and safety.

Each file keeps the original path in a header comment so readers can see what kind of module it came from.

## Suggested Order

1. [01-r2-storage-structure.ts](./01-r2-storage-structure.ts)
2. [02-r2-buckets-fallback.ts](./02-r2-buckets-fallback.ts)
3. [03-blob-store.ts](./03-blob-store.ts)
4. [04-r2-object-index.ts](./04-r2-object-index.ts)
5. [05-public-artifact-mirror.ts](./05-public-artifact-mirror.ts)
6. [06-file-serving-security.ts](./06-file-serving-security.ts)
7. [07-capsule-gateway-canonicalization.ts](./07-capsule-gateway-canonicalization.ts)
8. [08-storage-schema.ts](./08-storage-schema.ts)
9. [09-r2-buckets.test.ts](./09-r2-buckets.test.ts)
10. [10-public-artifact-mirror.test.ts](./10-public-artifact-mirror.test.ts)

## What To Look For

- direct comments that explain why the code exists
- compatibility and fallback paths that only appear in a real long-lived product
- tests around the uncomfortable edge cases
- schema shapes that make the control plane visible
