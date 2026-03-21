# storage-in-public

This repo is a public tour of the storage system behind Vibecodr.

It is not a generic storage framework. It is a source-backed explanation of how we use Cloudflare R2, D1, and Workers for uploads, runtime artifacts, public media, deduplicated blobs, secure serving, and cleanup.

## What You Can Learn Quickly

If you only have a few minutes, this repo should help you answer a few concrete questions:

- Why is this more than "files in a bucket"?
- How do private files, public media, and public runtime artifacts stay separate?
- How do deduplicated blobs and quota accounting coexist?
- How are dangerous user-controlled files served safely?
- What kinds of migrations and repair paths does a system like this need?

Start with:

1. [docs/quick-tour.md](./docs/quick-tour.md)
2. [docs/architecture.md](./docs/architecture.md)
3. [excerpts/README.md](./excerpts/README.md)

## What Is In Here

- docs that explain how the storage system is shaped and why
- curated source excerpts from the production repo
- selected test excerpts that pin tricky behavior
- reference artifacts for schema and keyspace orientation

## What It Is Not

- not a drop-in package
- not a sanitized demo app
- not a claim that the code is tiny or easy to transplant

The actual subsystem is large and cross-coupled because it sits at the center of uploads, runtime artifacts, public media delivery, quota accounting, secure file serving, compatibility, and repair jobs.

## Reading Paths

### If you want the big picture

- [docs/architecture.md](./docs/architecture.md)
- [docs/request-flows.md](./docs/request-flows.md)
- [docs/data-model.md](./docs/data-model.md)

### If you want the gritty source-backed bits

- [excerpts/01-r2-storage-structure.ts](./excerpts/01-r2-storage-structure.ts)
- [excerpts/02-r2-buckets-fallback.ts](./excerpts/02-r2-buckets-fallback.ts)
- [excerpts/03-blob-store.ts](./excerpts/03-blob-store.ts)
- [excerpts/05-public-artifact-mirror.ts](./excerpts/05-public-artifact-mirror.ts)
- [excerpts/06-file-serving-security.ts](./excerpts/06-file-serving-security.ts)
- [excerpts/09-r2-buckets.test.ts](./excerpts/09-r2-buckets.test.ts)
- [excerpts/10-public-artifact-mirror.test.ts](./excerpts/10-public-artifact-mirror.test.ts)

### If you want the "how did it end up like this?" layer

- [docs/failures-and-responses.md](./docs/failures-and-responses.md)
- [docs/source-map.md](./docs/source-map.md)

## A Note On Scale

Some of the production source files behind this repo are large. That is not the point of the repo, but it does explain why the public version is organized as a guided tour instead of a raw dump.

If you want the provenance and file map, see [docs/source-map.md](./docs/source-map.md).

## Cloudflare Context

As of 2026-03-21, Cloudflare's R2 docs still shape some of the design decisions here:

- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 bindings in Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/r2/)
- [Storing user generated content](https://developers.cloudflare.com/reference-architecture/diagrams/storage/storing-user-generated-content/)

Those constraints are part of why private reads stay Worker-mediated while truly public assets get their own custom-domain lanes.

## Repo Layout

```text
docs/
excerpts/
reference/
```

- `docs/` explains the system in plain language
- `excerpts/` shows selected source and test fragments
- `reference/` contains lighter-weight orientation artifacts

## Poke Around

If something here is confusing, incomplete, or too inside-baseball, open an issue. The whole point of the repo is to make the system easier to understand from the outside.

## License

Apache-2.0. See [LICENSE](./LICENSE).
