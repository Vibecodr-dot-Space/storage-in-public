# Source Map

This repo is derived from the private Vibecodr source tree, but it is not a subtree export.

This document shows where the public evidence came from and why those files were chosen.

## Source Areas Used

### Storage Core

- `workers/api/src/storage/r2.ts`
- `workers/api/src/storage/r2Buckets.ts`
- `workers/api/src/storage/blobStore.ts`
- `workers/api/src/storage/r2ObjectIndex.ts`
- `workers/api/src/storage/dependencyStore.ts`
- `workers/api/src/storage/quotas.ts`

### Storage Services

- `workers/api/src/services/storage/capsuleStorage.ts`
- `workers/api/src/services/storage/storageBrowserService.ts`
- `workers/api/src/services/storage/storageDownloadService.ts`
- `workers/api/src/services/storage/capsuleGateway/index.ts`

### Runtime Artifact Delivery

- `workers/api/src/runtime/publicArtifactMirror.ts`
- `workers/api/src/handlers/artifacts.ts`

### Security / Policy

- `workers/api/src/security/fileServing.ts`
- `workers/api/src/services/storage/storageEntitlements.ts`
- `packages/shared/src/policy/postMediaPolicy.ts`

### Schema

- `workers/api/src/db/schema.ts`

## Why These Files

These files were chosen because together they show the real storage story:

- key structure and lifecycle policy
- shared vs dedicated bucket logic
- deduplicated blob storage
- D1-backed object indexing
- public mirror behavior
- secure file serving
- migration compatibility
- tests for ugly edge cases

## Evidence Included In This Public Repo

| Public file | Derived from | Why it is here |
| --- | --- | --- |
| [../excerpts/01-r2-storage-structure.ts](../excerpts/01-r2-storage-structure.ts) | `storage/r2.ts` | key layout, lifecycle, memory/scanning pressure |
| [../excerpts/02-r2-buckets-fallback.ts](../excerpts/02-r2-buckets-fallback.ts) | `storage/r2Buckets.ts` | free-to-paid compatibility and cross-bucket reads |
| [../excerpts/03-blob-store.ts](../excerpts/03-blob-store.ts) | `storage/blobStore.ts` | shared physical dedup with logical accounting |
| [../excerpts/04-r2-object-index.ts](../excerpts/04-r2-object-index.ts) | `storage/r2ObjectIndex.ts` | category-driven quota and visibility semantics |
| [../excerpts/05-public-artifact-mirror.ts](../excerpts/05-public-artifact-mirror.ts) | `runtime/publicArtifactMirror.ts` | public runtime lane with leases and sentinel writes |
| [../excerpts/06-file-serving-security.ts](../excerpts/06-file-serving-security.ts) | `security/fileServing.ts` | storage as response-policy enforcement |
| [../excerpts/07-capsule-gateway-canonicalization.ts](../excerpts/07-capsule-gateway-canonicalization.ts) | `services/storage/capsuleGateway/index.ts` | migration-compatible canonical blob storage |
| [../excerpts/08-storage-schema.ts](../excerpts/08-storage-schema.ts) | `db/schema.ts` | D1 storage control-plane tables |
| [../excerpts/09-r2-buckets.test.ts](../excerpts/09-r2-buckets.test.ts) | `storage/r2Buckets.test.ts` | tests for fallback behavior |
| [../excerpts/10-public-artifact-mirror.test.ts](../excerpts/10-public-artifact-mirror.test.ts) | `runtime/publicArtifactMirror.test.ts` | tests for public mirror policy behavior |

## What We Left Out On Purpose

We did not dump the giant source files wholesale.

Reasons:

- some files carry unrelated product coupling
- some files contain too much operational or migration detail to be useful in one shot
- a curated transparency repo should help readers understand the system, not drown them in 2000-line files

## Summary

The private source looks like a real long-lived platform subsystem:

- large modules
- explicit repair paths
- migration compatibility
- careful serving code
- tests around uncomfortable behavior

This public repo should be read as a guided window into that system, not as a claim that the original codebase is small or tidy.
