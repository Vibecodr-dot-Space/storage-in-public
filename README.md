# storage-in-public

This repo is a public tour of the Vibecodr storage system as it exists after the 0A / 0A.2 storage-contract work.

If you only read one page, start with [docs/current-contract.md](./docs/current-contract.md).

## What You Can Learn Quickly

If you only have a few minutes, this repo should help you answer a few concrete questions:

- How does `sourceAccess` decide what viewers, studios, clones, exports, compile lanes, deploy lanes, and operators can actually see?
- How does backend-owned authored-path identity keep writes stable instead of letting the client invent path truth?
- How do public runtime bundles stay edge-friendly without exposing the canonical artifact lane?
- How do legacy public launches self-heal into the current runtime delivery system when they can no longer be mirrored directly?

Start with:

1. [docs/current-contract.md](./docs/current-contract.md)
2. [docs/quick-tour.md](./docs/quick-tour.md)
3. [docs/architecture.md](./docs/architecture.md)
4. [excerpts/README.md](./excerpts/README.md)

## What Is In Here

- docs that explain the system in plain language
- curated source excerpts from the production repo
- selected test excerpts that pin tricky behavior
- reference artifacts for schema and keyspace orientation

## What It Is Not

- not a drop-in package
- not a sanitized demo app
- not a claim that the code is tiny or easy to transplant

The actual subsystem is large and cross-coupled because it sits at the center of uploads, runtime artifacts, public media delivery, quota accounting, secure file serving, compatibility, and repair jobs.

## Reading Paths

### If you want the current contract first

- [docs/current-contract.md](./docs/current-contract.md)
- [docs/request-flows.md](./docs/request-flows.md)
- [docs/data-model.md](./docs/data-model.md)

### If you want the bigger shape

- [docs/architecture.md](./docs/architecture.md)
- [docs/quick-tour.md](./docs/quick-tour.md)
- [docs/source-map.md](./docs/source-map.md)

### If you want the gritty source-backed bits

- [excerpts/11-source-access.ts](./excerpts/11-source-access.ts)
- [excerpts/12-authored-layout.ts](./excerpts/12-authored-layout.ts)
- [excerpts/05-public-artifact-mirror.ts](./excerpts/05-public-artifact-mirror.ts)
- [excerpts/08-storage-schema.ts](./excerpts/08-storage-schema.ts)
- [excerpts/09-r2-buckets.test.ts](./excerpts/09-r2-buckets.test.ts)
- [excerpts/10-public-artifact-mirror.test.ts](./excerpts/10-public-artifact-mirror.test.ts)

### If you want the "how did it end up like this?" layer

- [docs/failures-and-responses.md](./docs/failures-and-responses.md)
- [docs/source-map.md](./docs/source-map.md)

## A Note On Scope

The production storage code touches a lot of neighboring concerns, so this public repo is organized as a guided tour instead of a raw dump.

If you want the provenance and file map, see [docs/source-map.md](./docs/source-map.md).

## Cloudflare Context

The design still follows the current Cloudflare R2 and Workers constraints that shape the live system:

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
