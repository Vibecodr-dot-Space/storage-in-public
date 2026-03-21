# Source Map

This repo was written from the real Vibecodr source tree, but it is not a subtree export.

These are the main source areas that informed the public docs.

## Storage Core

- `workers/api/src/storage/r2Buckets.ts`
- `workers/api/src/storage/r2ObjectIndex.ts`
- `workers/api/src/storage/r2.ts`
- `workers/api/src/storage/blobStore.ts`
- `workers/api/src/storage/dependencyStore.ts`
- `workers/api/src/storage/quotas.ts`

## Storage Services

- `workers/api/src/services/storage/storageCore.ts`
- `workers/api/src/services/storage/storageAssetService.ts`
- `workers/api/src/services/storage/storageBrowserService.ts`
- `workers/api/src/services/storage/storageDownloadService.ts`
- `workers/api/src/services/storage/capsuleStorage.ts`
- `workers/api/src/services/storage/capsuleGateway/*`

## Artifact Delivery

- `workers/api/src/runtime/publicArtifactMirror.ts`
- `workers/api/src/handlers/artifacts.ts`
- `workers/api/src/domain/studio/compile.ts`

## Cleanup / Repair

- `workers/api/src/maintenance/r2Lifecycle.ts`
- `workers/api/src/maintenance/r2Reconciliation.ts`
- `workers/api/src/maintenance/storageQuotaReconcile.ts`
- `workers/api/src/queues/r2CleanupConsumer.ts`

## Security / Policy

- `workers/api/src/security/fileServing.ts`
- `workers/api/src/services/storage/storageEntitlements.ts`
- `packages/shared/src/policy/postMediaPolicy.ts`

## Schema / Config

- `workers/api/src/db/schema.ts`
- `workers/api/wrangler.toml`
- `docs/SYSTEMS-REFERENCE.md`
- `docs/DOMAIN-REFERENCE.md`
- `functions/ai/overview.ts`

## Why This Is A Curated Release

Some of the original files are large because they carry:

- platform-specific branches,
- migration compatibility,
- internal incident history,
- product coupling beyond storage.

The goal of this repo is to preserve the strong ideas and the honest tradeoffs without pretending the public should read a giant internal module to understand the architecture.
