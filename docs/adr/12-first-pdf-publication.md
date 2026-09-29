# ADR 12 · Validate and publish one immutable PDF import

Status: implemented locally; product qualification pending · 2026-09-29.

## Decision

Keep extraction completion and publication separate. A complete worker candidate remains private
and Waiting. A trusted coordinator reserves a database-backed validation lease under the original
job deadline, with fresh worker credentials, a random token, a monotonic fence and at most three
attempts. Renewals derive duration from database time; revoked or expired authority cannot persist.

Validate the exact canonical-v2 bytes and resource graph, all required source-report checks, and
EPUB/canonical conservation. Run pinned EPUBCheck 5.4.0 in the network-disabled, bounded child.
Malformed content is terminal; a missing/crashed validation tool is an infrastructure retry.
Source checks do not assert human print-fidelity review. Keep blocking and reviewable findings
separate; only an authenticated AVA administrator may approve exactly the reviewable finding IDs.

Stage large bytes outside shared metadata locks with expiring private pins. A fresh transaction
rechecks operation, source, generation, candidate fence, review, provider settlement and exact
qualified reader capabilities. It reconstructs the accepted manifest from owned artifact rows,
compares its bytes, promotes exact pins and creates one immutable publication plus Ready intent.
The original PDF remains a format; the accepted EPUB becomes the primary readable format.
Internal canonical/reader JSON is not a reader-facing format. No later replacement exists.

## Reader compatibility

A code-owned qualification catalog binds independently tested reader and adapter fingerprints,
capabilities and evidence. Request headers cannot grant qualification. TEST records are refused
outside explicit isolated test mode. The catalog is empty until actual reader evidence is approved.

The original accepted manifest retains publication provenance. A separately registered compatible
new reader build may consume that same fixed book; unknown/revoked builds receive no downgrade.
Owned reader/resource/download helpers recheck live ownership and artifact byte hashes.

## Recovery and limits

Validation retries never invoke extraction or paid recognition. Cached successful validation avoids
repeating EPUBCheck. Human review after completed validation may outlive the execution deadline;
fresh publication authority does not revive a worker lease. Waiting or invalid candidate heads
cannot starve other work. Ready/Failed records and their required artifacts remain
immutable. Account deletion cascades private content; cost accounting follows ADR 11.

Database and sandbox evidence proves these boundaries only. It does not establish scanned-page
quality, phone capacity, accessibility or a released reader build. See
[[../specs/3-library/3.8-pdf-publication]] and [[../pdf-publication-checks]].
