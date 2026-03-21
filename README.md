# storage-in-public

Public documentation and reference artifacts for the Vibecodr storage architecture.

This repo is intentionally not a drop-in storage product. It is a transparent, architecture-first release of how Vibecodr uses Cloudflare R2, D1, and Workers to manage user files, compiled artifacts, public media, deduplicated blobs, and cleanup/reconciliation.

## What This Repo Is

- A public explanation of the real storage shape behind Vibecodr.
- A set of design docs that describe the control plane, data plane, and serving model.
- A small `reference/` folder with sanitized schemas and constants that make the docs concrete.

## What This Repo Is Not

- Not a turnkey replacement for the full Vibecodr storage stack.
- Not a promise that every helper here can be copied into another app unchanged.
- Not the entire production codebase dumped into public view.

The real system is tightly coupled to platform-specific concerns:

- auth and origin checks,
- paid-feature entitlements,
- artifact access policy,
- capsule lifecycle state,
- moderation/public-visibility rules,
- background repair and reconciliation jobs.

Publishing the raw subtree would show too much product-specific coupling and too much migration history. Publishing the architecture and the core patterns shows the real ideas without pretending they are a generic package.

## Architecture At A Glance

- R2 holds bytes. D1 is the control plane.
- `r2_objects` is the main index for object ownership, visibility, quota accounting, download resolution, and cleanup.
- Free-tier write paths use a shared bucket. Paid users can get dedicated buckets.
- Deduplicated capsule blobs intentionally live in the shared bucket, even for paid users, so cross-user deduplication works and remixes do not depend on another user's bucket surviving.
- Public media and public runtime artifacts use separate public-serving lanes from private objects.
- Private reads are mediated by Workers, not handed out as direct bucket URLs.
- Scheduled maintenance jobs reconcile D1 and R2 so the index does not silently drift away from the bytes.

## Credibility Notes

This repo keeps some of the scar tissue on purpose.

A lot of the architecture only makes sense once you understand the failure modes it grew out of:

- content-addressed capsule file keys caused collisions, so capsule storage moved to safer keys while deduplication was isolated into a blob-store path,
- a mixed public/private artifact lane was too broad, so public runtime delivery moved to a dedicated mirror bucket,
- quota/accounting could not depend on "R2 is the truth", so D1 indexing became first-class,
- cleanup could not be an afterthought, so lifecycle and reconciliation jobs became part of the design.

That kind of annotation increases trust when it is curated. The docs in this repo keep that format intentionally.

## Read First

- [Architecture](./docs/architecture.md)
- [Request Flows](./docs/request-flows.md)
- [Data Model](./docs/data-model.md)
- [Failures And Responses](./docs/failures-and-responses.md)
- [Security And Operations](./docs/security-and-operations.md)
- [Source Map](./docs/source-map.md)

## Bucket Topology

| Bucket lane | Role | Public? | Notes |
| --- | --- | --- | --- |
| Shared bucket | free-tier objects, shared blob store, fallback reads | no | canonical shared storage lane |
| Dedicated user buckets | paid-user private storage | no | created and managed per paid user |
| Public assets bucket | avatars, thumbnails, selected public user assets | yes | served through a custom domain |
| Public artifacts mirror bucket | publicly cacheable runtime bundles + manifest copies | yes | separate from canonical/private artifact storage |

## Why Private Reads Stay Worker-Mediated

As of 2026-03-21, Cloudflare's R2 docs still describe presigned URLs as bearer tokens, and they do not work on custom domains. Vibecodr's design therefore keeps private downloads behind the API worker and uses public custom-domain buckets only for content that is actually meant to be public.

That choice also keeps response headers, CSP, ownership checks, origin checks, entitlement checks, and visibility revocation in one place.

Relevant Cloudflare docs:

- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 bindings in Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/r2/)
- [Storing user generated content](https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/)

## Repository Layout

```text
docs/
  architecture.md
  data-model.md
  failures-and-responses.md
  request-flows.md
  security-and-operations.md
  source-map.md
reference/
  keyspaces.ts
  schema.sql
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
