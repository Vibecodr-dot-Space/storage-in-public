# Failures And Responses

This document exists because "trust us, we thought about it" is weaker than "here is what went wrong and where the response lives."

Every section below points to an excerpt file in this repo.

## 1. Capsule File Keys Were Too Broad

What went wrong:

- content-addressed capsule keys looked elegant
- they were too broad for user-facing file storage
- collisions in the wrong ownership context created real overwrite risk

Where to see it:

- [../excerpts/01-r2-storage-structure.ts](../excerpts/01-r2-storage-structure.ts)

Response:

- move canonical capsule file storage to safer per-capsule paths
- keep backward compatibility for old locations while migrating away

## 2. Free-To-Paid Storage Is Not A One-Bucket Story

What went wrong:

- users can have objects in both shared and dedicated lanes after upgrades or partial migration
- a naive "read from the current bucket only" model produces incomplete listings and surprising misses

Where to see it:

- [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts)
- [../excerpts/09-r2-buckets.test.ts](../excerpts/09-r2-buckets.test.ts)

Response:

- add a fallback bucket wrapper
- merge listings across lanes
- prefer primary bucket objects on key collision
- test the weird cases directly

## 3. Deduplication Needed A Stronger Physical/Logical Split

What went wrong:

- remixes can explode physical storage if every file is copied every time
- but per-user private buckets are the wrong home for globally deduplicated blobs

Where to see it:

- [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts)

Response:

- keep deduplicated blobs in the shared lane
- use D1 mappings and ref counts for logical ownership
- let users pay for logical usage while the platform keeps physical dedup savings

## 4. Bucket Contents Alone Were Not Enough

What went wrong:

- raw object storage cannot answer the platform's product questions by itself

Where to see it:

- [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts)
- [../excerpts/08-storage-schema.ts](../excerpts/08-storage-schema.ts)

Response:

- make `r2_objects` and related tables first-class
- use category to drive quota and visibility semantics
- use D1 as the control plane instead of pretending the bucket is the only source of truth

## 5. Public Runtime Delivery Needed Its Own Lane

What went wrong:

- fast public runtime delivery is attractive
- but canonical artifact storage still contains objects that should not be treated as public by default

Where to see it:

- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)
- [../excerpts/10-public-artifact-mirror.test.ts](../excerpts/10-public-artifact-mirror.test.ts)

Response:

- use a dedicated public artifact mirror bucket
- gate mirroring with access policy
- lease the mirror operation in D1
- write a sentinel manifest copy last so "mirror complete" is observable

## 6. Canonical Blob Storage Could Not Be A Flag Day

What went wrong:

- canonical blob storage is better, but old capsule reads still have to work during migration

Where to see it:

- [../excerpts/07-capsule-gateway-canonicalization.ts](../excerpts/07-capsule-gateway-canonicalization.ts)

Response:

- keep legacy-compatible reads
- canonicalize lazily for mutation paths
- verify coverage before flipping storage mode

## 7. Serving User Files Is A Security Problem

What went wrong:

- dangerous user-controlled file types are easy to mishandle if every route improvises response headers

Where to see it:

- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)

Response:

- centralize file serving policy
- apply CSP for scriptable types
- always send `nosniff`
- make the secure path the SSOT

## Why This Helps Trust

This repo is stronger when it shows the real pressure behind the architecture.

Users do not need us to claim perfection. They need to see:

- that the system has encountered hard edges
- that the responses are concrete
- that those responses live in real source, real schema, and real tests
