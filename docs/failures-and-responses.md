# Failures And Responses

This is the part we think makes the architecture more credible, not less credible.

The storage design did not appear fully-formed. Some of the current shape is a direct response to earlier failure modes.

## 1. Capsule File Keys Were Too Broad

Earlier pressure:

- content-addressable keying for capsule file storage looked elegant,
- but it created collision/data-loss risk when identical content appeared in the wrong ownership context.

Design response:

- move canonical capsule file storage to safer per-capsule paths,
- isolate deduplication into a dedicated blob-store model instead of making every user-facing file path content-addressed.

What this teaches:

- content addressing is powerful,
- but not every storage surface should be content-addressed just because deduplication is attractive.

## 2. Public Runtime Delivery Could Not Share A Mixed Bucket

Earlier pressure:

- public runtime bundles should load fast from the edge,
- but the canonical artifact store also held private or owner-only material.

Design response:

- create a dedicated public artifact mirror bucket,
- mirror only artifacts that the access policy says are publicly cacheable,
- keep revocation and purge behavior tied to that public lane.

What this teaches:

- "fast public delivery" and "canonical private storage" should often be different lanes.

## 3. Bucket Contents Alone Were Not Enough

Earlier pressure:

- it is tempting to treat bucket state as storage truth,
- but product questions need more than raw object existence.

Design response:

- make `r2_objects` first-class,
- use D1 for ownership, visibility, category, quota math, lookup resolution, and cleanup decisions,
- add reconciliation because D1 and R2 can drift.

What this teaches:

- object storage is rarely the whole storage system in a real product.

## 4. Deduplication Needed Logical Accounting

Earlier pressure:

- shared blobs and mirrored dependencies save large amounts of physical storage,
- but the product still needs user-level accounting and cleanup behavior.

Design response:

- separate physical bytes from logical billing/accounting,
- keep global deduplicated objects with explicit ref counts,
- track per-artifact or per-capsule logical ownership in D1.

What this teaches:

- "who pays" and "where the byte lives" are different architecture questions.

## 5. Cleanup Needed To Be A First-Class System

Earlier pressure:

- categories age differently,
- queue failures happen,
- migrations leave compatibility rows behind,
- indexes and buckets can drift over time.

Design response:

- lifecycle cleanup jobs,
- downgrade grace handling,
- reconciliation jobs for phantom/ghost objects,
- queue consumers that clean both bytes and index state.

What this teaches:

- if cleanup is not designed, it becomes a source of hidden product bugs and hidden cost.

## Why We Publish This

A polished architecture diagram without the failure history is easy to distrust.

A useful public architecture repo should explain:

- what went wrong,
- what changed,
- what tradeoff remains,
- why the present design is not arbitrary.
