# 12. Bounded classic reading import

Status: accepted · Date: 2026-10-27 · Scope: initial curated reading assets.

## Decision

Run a separate, explicit asset CLI; lock Catalog operations, not network/processing waits.
Extension (2026-10-29): curated-classics bootstrap may run before Open Library metadata. It creates
local descriptions with explicit provider provenance; the same inspection, processing, and review gates apply.
Later work/edition correction changes metadata relationships, never readable file identity. Private
links remain user-owned in Main and use the library's offline queue, with no private data in Catalog.
Public edits never inspect or rewrite private associations, including when made by an admin.
Start with a small curated title/author list and exact source edition links, not broad API search.
Inventory is offline; inspection downloads unrestricted IA EPUBs; application prepares unpublished
copies without prior approval. Existing Clerk admin authorization protects ingestion, preview,
and the review queue. Only an explicit admin Publish records file-bound rights/quality approval.

Main owns processing, publication, and an immutable import identity. Catalog owns public bytes,
edition provenance, and READY pointers. Signed publication delivery synchronizes the stores;
main commits first, so a crash cannot create a READY pointer to an unprocessed file. A persistent
publication-pending flag and revision drive retryable main-to-Catalog synchronization. That narrow
endpoint uses timestamped HMAC with READING_ASSET_SYNC_SECRET on both services; it cannot import
files or access user data. Missing credentials fail closed. No cross-database client is introduced.
A withdrawn identity may be restored only after fresh explicit rights/quality review.

## Storage decision

The initial main-blob pilot exception is superseded by [ADR 13](13-catalog-public-book-storage.md).
Public bytes and provider snapshots live in Catalog PostgreSQL. Main stores user data, private
upload bytes, and lightweight public-book descriptors; no public-file bytes are written there.

## Consequences

ADR 14 supersedes the bearer-token requirement: server operators use scoped signed internal requests;
browser-token imports remain supported. Replay is safe. Reviews happen in the admin queue, including a normal-reader preview
granted only to the reviewing admin. Unknown rights never publish. Existing acquired copies retain
access under ADR 11; synchronization withdraws new acquisition only. Publication credentials must
be configured before launch; signed revisions prevent delayed delivery from reversing newer state.

## Additional curated EPUB providers (2026-10-29)

Standard Ebooks and Wolne Lektury use explicit provider IDs, canonical source/download URLs and
SHA-256 identities; no fabricated IA IDs. Provider-specific editions share existing curated work
descriptions. Bounded downloads allow only each provider's HTTPS hosts, including redirects.
Snapshots retain source metadata and notices. Inspection resets approval; application re-fetches
and verifies the exact bytes before staging. No provider listing implies rights or quality approval.
