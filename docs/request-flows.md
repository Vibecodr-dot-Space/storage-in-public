# Request Flow Atlas

Last updated: 2026-04-05

Use this as the canonical walkthrough for end-to-end requests across Studio, API, and storage workers.

## 1) Studio Source Persistence

1. User opens `/post/new` or a Studio route in `apps/web`.
2. Studio saves source edits through `GET|PUT /capsules/:id/files/:path` and `PATCH /capsules/:id/manifest`.
3. Backend mutation handlers own canonical authored path identity and return the persisted path truth back to Studio.
4. Legacy-preserved capsules and standardized authored capsules can therefore share one edit surface without the client inventing storage identity locally.
5. Autosave persists source only. No live post mutation happens on save.

Key checks in the flow:

- authored path normalization happens server-side
- manifest entry truth is tied to the authored layout mode
- callers that still rely on legacy preservation stay compatible

## 2) Draft Runtime Preview Compile

1. Studio requests `POST /capsules/:id/compile-draft`.
2. `workers/api/src/domain/studio/compile.ts` loads the capsule source through the canonical source-access contract.
3. The compiler applies safety checks and creates a draft artifact.
4. Draft compile writes a runtime manifest plus bundle files to R2/KV so Studio can preview the real runtime lane before publish.
5. Compile warnings are part of the contract, not decoration. They surface entry auto-correction and skipped runtime compile inputs so creators can see when the runtime lane diverged from raw source expectations.

## 3) Canonical Publish Flow

1. Studio requests `POST /capsules/:id/publish`.
2. `workers/api/src/domain/studio/publish.ts` is the canonical publish owner.
3. Publish validates manifest and intent, reuses sanitized source, and calls `createRuntimeArtifactForCapsule()` in `workers/api/src/services/storage/capsuleStorage.ts`.
4. The publish response returns the final live truth, including requested versus effective visibility, quarantine and policy overrides, and post-commit status.
5. Publish adopts the artifact into the capsule and post graph through capsule lifecycle SSOT.
6. The response returns the final `postId`, artifact summary, republish state, and any best-effort warnings.

Key checks in the flow:

- plan and quota guards
- safety checks in artifact and capsule handlers
- post visibility policy before surfacing on feed/profile
- republish activity uses the current post-published contract

## 4) Public Runtime Delivery

1. The API worker resolves the runtime manifest for a public artifact.
2. `publicArtifactMirror.ts` checks publish configuration, then decides whether the artifact is publicly cacheable and artifact-scoped enough to mirror.
3. `publishedArtifactCacheWarm.ts` primes the API and public lanes after publish or open.
4. The mirror path re-checks eligibility after it claims the lease, writes bundle objects to the dedicated public mirror bucket, deletes stale copies if the final check flips private, and writes the manifest copy sentinel last.
5. Anonymous runtime traffic only sees the public lane once the mirror is actually ready.

Pressure that shaped this flow:

- public edge delivery was desired
- public eligibility still had to be revocable
- the canonical/private artifact lane could not quietly become public

## 5) Private Download and Source Access

1. Authenticated users request private storage downloads or source reads.
2. `storageDownloadService.ts` and `sourceAccess.ts` own the current intent shaping.
3. The request is checked against owner origin, entitlement, and the relevant access intent.
4. D1 lookup resolves the canonical object or source snapshot.
5. The Worker applies secure response headers, content type shaping, CSP for scriptable types, and HTTP range support.

Why this flow exists:

- it keeps policy at the application layer
- it avoids bearer-style presigned URL sprawl for private objects
- it lets the platform control CSP, `nosniff`, and visibility semantics

## 6) Legacy Public Open Promotion

1. A viewer opens an old public artifact that is still cacheable but not mirrorable.
2. The request still serves the current artifact immediately.
3. The request queues a background promotion if one is not already in flight.
4. The worker rebuilds a new artifact from the canonical capsule bundle.
5. Capsule lifecycle SSOT switches live posts off the old artifact and onto the new one.
6. The new artifact is mirrored and warmed, and any stale launch-contract mirror state is refreshed.

This is the current answer to the old Worker-only lane problem.

## 7) Cleanup And Reconciliation

There are two different maintenance ideas:

- lifecycle cleanup: delete or expire things according to category rules
- reconciliation: compare D1 and R2 and repair drift

Examples:

- retain drafts
- remove orphaned avatars, covers, and thumbnails
- keep artifacts intentionally permanent unless policy says otherwise
- detect D1 rows that no longer have backing R2 objects
- report R2 objects that are not indexed

## Invariant Matrix by Surface

| Surface | Primary Gate | Data Stores | Security Controls | Observability |
| --- | --- | --- | --- | --- |
| Studio / source reads | auth + sourceAccess intent | D1, R2 | intent shaping, CSP where needed | runtime events + API logs |
| Studio writes | auth + authoredLayout mode | D1, R2 | backend-owned path identity | publish telemetry + warnings |
| Publish | route auth + policy | D1, R2, KV, DO | rate-limits, moderation gates, mirror eligibility | analytics + runtime events |
| Public runtime | public mirror readiness | R2 mirror bucket | revocable mirror policy | artifact warmup and mirror telemetry |
| Private downloads | owner origin + entitlement | D1, R2 | secure headers, `nosniff`, CSP | API logs + runtime events |
| Legacy promotion | promotion queue + lifecycle SSOT | D1, R2 | dedupe, retry, visibility checks | promotion state + warmup telemetry |

## Failure Escalation Steps

1. Confirm the route path maps to the expected owner in `docs/WORKER-LANDSCAPE.md` and `docs/SYSTEM-MAP.md`.
2. Check contract mismatch:
   - Did route parameters or payload shape change?
3. Check rate-limit and quota path:
   - `packages/shared/src/rateLimits.ts`, `packages/shared/src/plans.ts`.
4. Inspect relevant event streams:
   - `runtime_events`
   - API logs
   - mirror and promotion telemetry
5. If the data layer is suspect:
   - verify table ownership in `docs/DOMAIN-REFERENCE.md`
   - ensure the migration path in `workers/api/drizzle/migrations/*` aligns
6. For storage issues:
   - verify source-access intent and authored-layout mode first
   - then check the relevant bucket lane, mirror lane, or promotion lane
