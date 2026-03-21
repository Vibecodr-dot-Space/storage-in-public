# storage-in-public

This repo is a public tour of the storage system behind Vibecodr.

It is not a generic storage framework. It is a source-backed explanation of how we use Cloudflare R2, D1, and Workers for uploads, runtime artifacts, public media, deduplicated blobs, secure serving, and cleanup.

## What This Repo Contains

- docs about how the storage system is shaped and why it is shaped that way
- curated source excerpts from the real production repo
- selected test excerpts that show we actually pinned tricky behavior
- simplified reference artifacts for schema and keyspace orientation

## What This Repo Does Not Pretend To Be

- not a drop-in package
- not a sanitized demo app
- not a claim that the code is tiny, elegant, or easy to transplant

The actual subsystem is large and cross-coupled because it sits at the center of:

- user uploads
- runtime artifacts
- public media delivery
- quota accounting
- access control
- secure file serving
- migration compatibility
- cleanup and reconciliation

This is a real product subsystem, and it behaves like one.

## Start Here

- [docs/architecture.md](./docs/architecture.md)
- [docs/failures-and-responses.md](./docs/failures-and-responses.md)
- [docs/source-map.md](./docs/source-map.md)
- [excerpts/README.md](./excerpts/README.md)

## What The Real Source Looks Like

At extraction time, some of the core source files in the private repo were approximately:

| Source file | Approx. lines | Why it matters |
| --- | ---: | --- |
| `workers/api/src/services/storage/capsuleStorage.ts` | 2700 | publish-time storage, artifact creation, dependency accounting, cleanup hooks |
| `workers/api/src/storage/r2.ts` | 2159 | key structure, file classification, integrity utilities, storage helpers |
| `workers/api/src/handlers/artifacts.ts` | 1860 | runtime artifact serving, manifest loading, mirror integration |
| `workers/api/src/storage/r2ObjectIndex.ts` | 1506 | ownership index, quota categories, visibility, bucket resolution |
| `workers/api/src/services/storage/storageBrowserService.ts` | 1178 | storage browser and user-facing object/capsule views |

These are not small files, and that is part of the story. Storage here is tied to runtime delivery, quota math, visibility, compatibility, and repair flows.

## What You Will Find Here

This repo includes:

- key migrations that happened because earlier assumptions were wrong
- cross-bucket fallback behavior for free-to-paid storage transitions
- deduplicated blob storage with shared physical bytes and logical accounting
- a dedicated public artifact mirror lane instead of a hand-wavy "CDN bucket"
- secure serving for scriptable user files
- tests for tricky storage behavior that would otherwise regress quietly

## Recommended Reading Order

1. [docs/architecture.md](./docs/architecture.md)
2. [excerpts/01-r2-storage-structure.ts](./excerpts/01-r2-storage-structure.ts)
3. [excerpts/02-r2-buckets-fallback.ts](./excerpts/02-r2-buckets-fallback.ts)
4. [excerpts/03-blob-store.ts](./excerpts/03-blob-store.ts)
5. [excerpts/05-public-artifact-mirror.ts](./excerpts/05-public-artifact-mirror.ts)
6. [excerpts/06-file-serving-security.ts](./excerpts/06-file-serving-security.ts)
7. [docs/failures-and-responses.md](./docs/failures-and-responses.md)

## Cloudflare Context

As of 2026-03-21, Cloudflare's R2 docs still matter to how this system is designed:

- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 bindings in Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/r2/)
- [Storing user generated content](https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/)

Those constraints are one reason private reads stay Worker-mediated while truly public assets get their own custom-domain lanes.

## Repo Layout

```text
docs/
excerpts/
reference/
```

- `docs/` explains the system in plain language
- `excerpts/` shows selected source and test fragments
- `reference/` contains lighter-weight orientation artifacts

## License

Apache-2.0. See [LICENSE](./LICENSE).
