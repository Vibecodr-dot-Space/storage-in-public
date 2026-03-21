# Quick Tour

This is the fast on-ramp.

If you only want the shape of the system, these are the main ideas.

## 1. The Storage System Is R2 Plus D1 Plus Workers

R2 holds bytes.

D1 holds:

- ownership
- visibility
- quota categories
- object lookup metadata
- blob and dependency references
- mirror and cleanup state

Workers decide:

- which bucket to use
- whether something is public or private
- how files are served
- when cleanup or mirroring should happen

See:

- [architecture.md](./architecture.md)
- [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts)
- [../excerpts/08-storage-schema.ts](../excerpts/08-storage-schema.ts)

## 2. There Are Multiple Storage Lanes

The system uses:

- a shared private bucket
- dedicated private buckets for paid users
- a public assets bucket
- a separate public artifact mirror bucket

That split exists because user media, private artifacts, and publicly cacheable runtime bundles have different serving and lifecycle needs.

See:

- [architecture.md](./architecture.md)
- [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts)
- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)

## 3. Deduplication Is Physical, Accounting Is Logical

Capsule blobs and mirrored dependencies can be physically shared while still being logically charged and tracked per user or per artifact.

See:

- [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts)
- [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts)
- [data-model.md](./data-model.md)

## 4. Private Reads Stay Worker-Mediated

The system does not hand out private bucket access and call it done.

Private reads go through:

- auth
- origin checks
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
