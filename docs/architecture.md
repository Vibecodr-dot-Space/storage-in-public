# Architecture

Last updated: 2026-04-05

This is the high-level shape of the production storage subsystem behind Vibecodr.

For the current contract first, cross-check this page with [current-contract.md](./current-contract.md).

## The Core Claim

Vibecodr does not treat storage as "an R2 bucket with some uploads."

The storage system is a platform subsystem with at least six coupled concerns:

- source-access intent shaping
- authored-path identity and write normalization
- byte storage in R2
- ownership and lookup state in D1
- secure file serving
- public artifact mirroring and repair

That is why the private source modules are large. The complexity is structural, not decorative.

## The Shape

```mermaid
flowchart LR
  A["Studio / Web / Runtime"] --> B["API Worker"]
  B --> C["sourceAccess SSOT"]
  B --> D["authoredLayout + capsuleFiles"]
  B --> E["D1 control plane"]
  B --> F["Shared R2 bucket"]
  B --> G["Dedicated user buckets"]
  B --> H["Public assets bucket"]
  B --> I["Public artifact mirror bucket"]
  B --> J["Legacy promotion queue"]
  K["Scheduled jobs"] --> E
  K --> F
  K --> G
  K --> H
  K --> I
  K --> J
```

## The Buckets Are Not The Whole Story

The important system boundary is the Worker plus the D1 control plane.

Why:

- private reads need auth and intent shaping
- response headers matter for dangerous file types
- public eligibility can change after an artifact was once public
- free-to-paid migrations can leave data in multiple bucket lanes
- quota and ownership cannot be derived from bucket listing alone

Relevant evidence:

- [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts)
- [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts)
- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)

## Source Access And Authored Writes

The current contract separates two questions that used to get blurred together:

- what should a caller be allowed to see?
- how should a caller's authored path be normalized before it is written?

That split is owned by `sourceAccess`, `authoredLayout`, and `capsuleFiles`, not by whichever caller happens to be saving a file.

Relevant evidence:

- [../excerpts/11-source-access.ts](../excerpts/11-source-access.ts)
- [../excerpts/12-authored-layout.ts](../excerpts/12-authored-layout.ts)

## Shared Bucket, Dedicated Bucket, Public Lanes

The system intentionally uses multiple storage lanes:

- a shared private bucket
- dedicated per-user private buckets for paid storage
- a public assets bucket
- a separate public artifact mirror bucket

It exists because different object classes need different delivery and lifecycle behavior:

- user-visible media is not the same as runtime artifacts
- publicly cacheable runtime bundles are not the same as canonical private artifact storage
- deduplicated blobs need a shared physical home to work well across users and remixes

Relevant evidence:

- [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts)
- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)

## D1 Is The Storage Control Plane

The D1 control plane is where the platform answers storage questions:

- who owns this object
- what category is it
- does it count toward quota
- how should it be served
- can it be downloaded by object id or share token
- what cleanup should happen if the backing bytes disappear
- what mode the capsule is in for storage and authored layout
- whether a legacy public launch still needs promotion

Relevant evidence:

- [./data-model.md](./data-model.md)
- [../docs/current-contract.md](./current-contract.md)

## The System Carries Migration History

The current architecture grew out of real problems:

- content-addressed capsule keys were too broad
- free-to-paid storage transitions created cross-bucket reality
- public runtime delivery could not safely share the canonical artifact lane
- canonical blob storage had to be introduced without breaking old reads
- legacy public launches needed a dedicated self-heal lane instead of a permanent Worker-only path

That is why there are compatibility and fallback paths in the source.

Relevant evidence:

- [../excerpts/01-r2-storage-structure.ts](../excerpts/01-r2-storage-structure.ts)
- [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts)
- [../excerpts/07-capsule-gateway-canonicalization.ts](../excerpts/07-capsule-gateway-canonicalization.ts)

## Security Is Part Of Storage

The code does not assume "if a file exists, just return it."

Instead it centralizes:

- CSP for scriptable file types
- `nosniff`
- resource policy headers
- controlled serving paths for dangerous user-controlled content

Relevant evidence:

- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)

## Tests Matter Here

The uncomfortable parts of the design are tested:

- cross-bucket fallback listing
- primary/fallback failure behavior
- public mirror access re-checks and in-memory bucket behavior

Relevant evidence:

- [../excerpts/09-r2-buckets.test.ts](../excerpts/09-r2-buckets.test.ts)
- [../excerpts/10-public-artifact-mirror.test.ts](../excerpts/10-public-artifact-mirror.test.ts)
