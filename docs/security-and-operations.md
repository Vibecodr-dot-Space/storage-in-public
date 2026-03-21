# Security And Operations

This document covers the parts of the storage architecture that are easy to underestimate.

For the evidence layer behind these claims, see:

- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)
- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)
- [../excerpts/08-storage-schema.ts](../excerpts/08-storage-schema.ts)
- [../excerpts/09-r2-buckets.test.ts](../excerpts/09-r2-buckets.test.ts)
- [../excerpts/10-public-artifact-mirror.test.ts](../excerpts/10-public-artifact-mirror.test.ts)

## Security Model

### Private Reads Stay Behind Workers

The platform deliberately does not treat private bucket access as a frontend concern.

Private download routes do application-layer work before a byte is returned:

- auth,
- owner-origin checks,
- entitlement checks,
- lookup in the D1 index,
- content-type aware serving,
- CSP and `X-Content-Type-Options: nosniff`,
- HTTP Range handling.

That means the effective storage boundary is the Worker, not the bucket URL.

### Public Does Not Mean Everything On The Same Bucket Is Public

The system separates:

- public media,
- public runtime artifacts,
- private canonical artifacts,
- private user storage.

That sounds obvious, but it is one of the easiest mistakes to blur over time. This architecture uses separate lanes to keep that boundary durable.

### Share Tokens Are Hashed And Encrypted

The index supports reference-style URLs using token metadata, but the raw share token is not stored plainly in D1. The system stores:

- a lookup hash,
- encrypted token material,
- created/rotated timestamps.

### Scriptable Content Gets Hardened Headers

Scriptable user file types such as:

- HTML,
- SVG,
- XML,
- XHTML,
- `*+xml`

are served with a restrictive CSP and `nosniff`. Interactivity belongs in the runtime sandbox, not in "downloaded user files" served from generic endpoints.

## Why Not Just Use Presigned URLs Everywhere?

As of 2026-03-21, Cloudflare documents two relevant constraints:

- presigned URLs are bearer tokens,
- presigned URLs work on the S3 API domain and not on R2 custom domains.

That makes them a bad universal abstraction for this system.

Vibecodr instead uses:

- Worker-mediated private reads for policy-heavy objects,
- public custom-domain buckets only where the object is meant to be directly public.

## Operational Model

### Lifecycle Jobs

Lifecycle rules are not uniform:

- drafts are retained,
- artifacts are intentionally permanent,
- thumbnails can expire,
- avatars/covers can be cleaned up when orphaned,
- downgraded paid buckets can be cleaned after a grace window.

This is why the system needs category-aware cleanup logic rather than a generic "delete old objects" cron.

### Reconciliation Jobs

D1 and R2 can drift apart. The architecture expects that.

Representative drift cases:

- phantom objects: indexed in D1, missing in R2,
- ghost objects: present in R2, missing in D1.

The reconciliation job repairs or reports those cases instead of assuming the write path is always perfect forever.

### Leases And Idempotency

Some jobs use short-lived D1 leases to stop concurrent requests from stepping on each other. The public artifact mirror flow is the cleanest example.

### Logical Accounting Over Physical Storage

One of the strongest operational ideas in the system is this:

- physical storage location and user billing are not the same question.

Deduplicated blobs and dependencies can be physically shared while still being logically charged/ref-counted in a way that matches product expectations.

## What We Would Publish Raw vs Curated

Good to publish raw or nearly raw:

- schema shape,
- keyspace conventions,
- design decisions,
- request and maintenance flows.

Better to curate before publishing:

- very large source files with platform-specific branches,
- migration-compatibility layers,
- internal incident/fix tags embedded in local comments,
- product-specific entitlement and moderation coupling.
