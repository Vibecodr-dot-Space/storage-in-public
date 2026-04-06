# Data Model

These are the storage control-plane concepts that matter most to understanding the current system.

## Current Control Surfaces

### Capsule storage state

The capsule record is still the parent record, but storage mode is now explicit instead of being inferred from where bytes happen to live.

### Authored layout state

The backend owns whether a capsule is still in the legacy-preserve layout or has moved to the standardized authored layout.

### Object index

The object index tracks the metadata needed for lookup, visibility, ownership, cleanup, and share-token handling.

### Blob store

The blob store is content-addressable storage for deduplicated capsule files.

### Capsule-file links

Capsule files resolve to blob digests, which makes the capsule file system a real logical layer instead of a blob cache.

### Dependency store

Mirrored runtime dependencies are stored as content-addressed objects so they can be shared physically while still being referenced consistently.

### Dependency aliases

An alias layer lets one dependency digest appear under multiple public keys while still resolving back to a single digest.

### Artifact dependency links

Artifact-level dependency links keep logical references to shared dependency objects explicit without duplicating the physical bytes.

### Public mirror lease state

A lease record prevents multiple requests from racing the same mirror job.

### Legacy promotion queue

A queue and dedupe layer handles old public launches that need promotion onto the current runtime delivery path.

### Capsule backend links

Capsule-backend links tie a capsule to the backend pulse that serves server-side code.

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

Representative visibility modes include:

- `private`
- `public`
- `public_cdn`

## Why The Index Exists

The design assumption is:

> bucket contents are not enough to answer storage-system questions.

You cannot reliably derive these things from R2 alone:

- who owns the object
- whether it counts toward quota
- whether it is browser-public
- whether it should resolve by share token
- whether deleting it should decrement logical usage
- whether a public artifact mirror should exist
- whether a capsule is still on a legacy storage or authored-layout mode
- whether a legacy public launch needs promotion

That is why the D1 control plane is not optional architecture glue. It is the authoritative state layer.
