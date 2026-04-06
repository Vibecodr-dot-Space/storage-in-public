# Data Model

These are the storage-specific tables that matter most to understanding the current system.

For the source-backed version, see:

- [../excerpts/08-storage-schema.ts](../excerpts/08-storage-schema.ts)
- [../reference/schema.sql](../reference/schema.sql)

## Current Control Tables

### `capsules`

The capsule row is still the parent record, but it is no longer asked to carry every storage decision by itself.

### `capsule_storage_modes`

Tracks whether a capsule is still in `legacy_compat` or has moved to `canonical_blob`.

This is the current way the system remembers whether read paths should prefer the compatibility lane or the canonical blob lane.

### `capsule_authored_layout_modes`

Tracks whether a capsule is still in `legacy_preserve_v1` or has moved to `standardized_authored_v1`.

This table is the backend-owned record of authored-path identity.

### `r2_objects`

The main index for object ownership and storage policy.

Important columns:

- `bucket_name`
- `r2_key`
- `object_id`
- `owner_id`
- `category`
- `size_bytes`
- `content_type`
- `visibility`
- optional share-token hash/ciphertext metadata

Representative uses:

- look up by object id for downloads
- list storage objects for a user
- account for quota categories
- classify object visibility
- remove rows during cleanup
- reconcile D1 and R2

### `blobs`

Content-addressable store for deduplicated capsule files.

Important columns:

- `sha256`
- `size_bytes`
- `content_type`
- `bucket_name`
- `r2_key`
- `ref_count`
- `ref_version`

### `capsule_blobs`

Maps a capsule file path to a blob hash.

Important columns:

- `capsule_id`
- `file_path`
- `blob_sha256`

This is what turns the blob store into a real capsule file system rather than just a blob cache.

### `dependency_objects`

Content-addressed metadata for mirrored runtime dependencies.

Important columns:

- `sha256`
- `size_bytes`
- `content_type`
- `canonical_r2_key`
- `ref_count`
- `ref_version`

### `dependency_object_aliases`

Allows one dependency object to have multiple R2 keys or aliases while still pointing back to one digest.

Important columns:

- `r2_key`
- `dependency_sha256`
- `content_type`

### `artifact_dependency_refs`

Tracks logical ownership of dependency objects by a specific artifact.

Important columns:

- `artifact_id`
- `dependency_sha256`
- `source_ref`
- `relation_kind`

This is what lets the platform charge logical bytes per artifact even if the physical dependency object is globally shared.

### `public_artifact_mirror_leases`

Simple lease table to stop multiple requests from racing the same mirror job.

Important columns:

- `artifact_id`
- `lease_expires_at`
- `updated_at`

### `legacy_artifact_promotions`

Queue and dedupe state for legacy public launches that should be promoted onto the current runtime delivery path.

Important columns:

- `legacy_artifact_id`
- `capsule_id`
- `status`
- `new_artifact_id`
- `attempt_count`
- `last_requested_at`
- `last_attempt_at`
- `completed_at`
- `last_surface`
- `last_error_code`
- `last_error_message`

### `capsule_backends`

Links a capsule to its backend pulse when a project publishes server-side code.

Important columns:

- `capsule_id`
- `pulse_id`

## Categories And Visibility

Representative object categories include:

- `avatar`
- `cover`
- `thumbnail`
- `user_asset`
- `draft`
- `artifact_bundle`
- `artifact_source`
- `artifact_manifest`

The category does real work:

- it influences visibility
- it determines whether bytes count toward user quota
- it helps lifecycle jobs decide how to clean up a prefix

Representative visibility modes:

- `private`
- `public`
- `public_cdn`

## Why The Index Exists

The design assumption is:

> bucket contents are not enough to answer product questions.

You cannot reliably derive these things from R2 alone:

- who owns the object
- whether it counts toward quota
- whether it is browser-public
- whether it should resolve by share token
- whether deleting it should decrement logical usage
- whether a public artifact mirror should exist
- whether a capsule is still on a legacy storage or authored-layout mode
- whether a legacy public artifact needs promotion

That is why the D1 layer is not optional architecture glue. It is the authoritative control plane.

## Reference Files

For a concrete, simplified version of the schema, see:

- [reference/schema.sql](../reference/schema.sql)
- [reference/keyspaces.ts](../reference/keyspaces.ts)
