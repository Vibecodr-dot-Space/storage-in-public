# Failures And Responses

This document covers a few of the moments that shaped the current storage system.

Each section below points to an excerpt file in this repo.

## 1. Source Identity Had To Move Backend-Side

What changed:

- source reads, clones, deploys, and exports were all trying to infer too much from the caller
- the current contract now makes source-access intent explicit

Where to see it:

- [../excerpts/11-source-access.ts](../excerpts/11-source-access.ts)

Where the system landed:

- keep source visibility decisions in the SSOT
- shape viewer, studio, clone, export, compile, deploy, and operator snapshots differently
- return the path truth the backend accepted instead of letting the client invent it

## 2. Authored Writes Needed A Real Layout Mode

What changed:

- authored-path identity used to be implied by whatever layout the client happened to send
- legacy-preserve and standardized-authored modes now have explicit owners

Where to see it:

- [../excerpts/12-authored-layout.ts](../excerpts/12-authored-layout.ts)

Where the system landed:

- keep legacy-preserve capsules editable
- standardize authored writes only when the backend owns the path identity
- normalize manifest entry and authored file paths together so the write contract stays coherent

## 3. Deduplication Needed A Stronger Physical/Logical Split

What changed:

- remixes can explode physical storage if every file is copied every time
- but per-user private buckets are the wrong home for globally deduplicated blobs

Where to see it:

- [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts)

Where the system landed:

- keep deduplicated blobs in the shared lane
- use D1 mappings and ref counts for logical ownership
- let users pay for logical usage while the platform keeps dedup savings as cost reduction

## 4. Public Runtime Delivery Needed Its Own Lane

What changed:

- fast public runtime delivery is attractive
- but canonical artifact storage still contains objects that should not be treated as public by default

Where to see it:

- [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts)
- [../excerpts/10-public-artifact-mirror.test.ts](../excerpts/10-public-artifact-mirror.test.ts)

Where the system landed:

- use a dedicated public artifact mirror bucket
- gate mirroring with publish config, access policy, and artifact-scoped bundle keys
- lease the mirror operation in D1
- re-check eligibility after the lease is claimed and again before commit
- clean up stale public copies if access flips private mid-mirror
- write a sentinel manifest copy last so "mirror complete" is observable

## 5. Legacy Public Launches Could Not Stay on the Worker-Only Lane Forever

What changed:

- some old public launches were cacheable, but their bundle keys could not be mirrored directly
- leaving them forever on the Worker-only path was correct but slow

Where to see it:

- [../docs/current-contract.md](./current-contract.md)

Where the system landed:

- queue a background promotion for the true legacy class
- rebuild the artifact from the canonical capsule bundle
- switch live posts through capsule lifecycle SSOT
- warm and mirror the new runtime lane
- refresh stale launch-contract mirror state when the old manifest copy is still around

## 6. Serving User Files Is A Security Problem

What changed:

- dangerous user-controlled file types are easy to mishandle if every route improvises response headers

Where to see it:

- [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts)

Where the system landed:

- centralize file serving policy
- apply CSP for scriptable types
- always send `nosniff`
- make the secure path the SSOT

## Why This Section Exists

The storage system makes more sense when you can see the pressure behind it.

The goal here is simple:

- show where the current shape came from
- point to the source that reflects it
- make the docs easier to connect back to the code
