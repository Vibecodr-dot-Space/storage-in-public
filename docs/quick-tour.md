# Quick Tour

If you only want the current shape of the system, start with [current-contract.md](./current-contract.md).

If you only have a few minutes, these are the main ideas.

## 1. The Storage System Is Still R2 Plus D1 Plus Workers

The storage core is still physical bytes in R2 and control-plane state in D1, with Workers deciding how requests are shaped.

What changed in the 0A / 0A.2 contract work is that the owners are now explicit:

- `sourceAccess` owns what a viewer, studio, clone, export, compile, deploy, or operator can see.
- `capsuleFiles` plus `authoredLayout` own authored-path identity and write normalization.
- `publicArtifactMirror` plus `publishedArtifactCacheWarm` own public runtime delivery and warmup.
- the legacy promotion queue owns self-healing for legacy public launches.

See:

- [current-contract.md](./current-contract.md)
- [architecture.md](./architecture.md)
- [../excerpts/11-source-access.ts](../excerpts/11-source-access.ts)

## 2. There Are Still Multiple Storage Lanes

The system still uses:

- a shared private bucket
- dedicated private buckets for paid users
- a public assets bucket
- a separate public artifact mirror bucket

That split still exists because user media, private artifacts, canonical runtime artifacts, and publicly cacheable runtime bundles have different serving and lifecycle needs.

See:

- [architecture.md](./architecture.md)
- [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts)
- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)

## 3. Deduplication Is Physical, Attribution Is Logical

Capsule blobs and mirrored dependencies can be physically shared while still being tracked with separate logical references per user or per artifact.

See:

- [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts)
- [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts)
- [data-model.md](./data-model.md)

## 4. Private Reads Stay Worker-Mediated

The system does not hand out private bucket access and call it done.

Private reads go through:

- auth
- source-access intent shaping
- lookup in D1
- secure response headers
- CSP for dangerous file types

See:

- [security-and-operations.md](./security-and-operations.md)
- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)

## 5. Migrations And Repair Paths Are Part Of The Design

The source carries compatibility and cleanup paths because the system has changed over time and real storage can drift.

See:

- [failures-and-responses.md](./failures-and-responses.md)
- [../excerpts/07-capsule-gateway-canonicalization.ts](../excerpts/07-capsule-gateway-canonicalization.ts)
- [request-flows.md](./request-flows.md)
