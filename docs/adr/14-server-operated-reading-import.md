# 14. Server-operated reading imports

Status: accepted · Date: 2026-10-29 · Amends ADR 12's requirement for a Clerk admin import session.

## Decision

Operators with production-server access may ingest, inspect processing status and publish public
reading files without a user session or admin account. The importer uses the existing server-only
READING_ASSET_SYNC_SECRET, supplied through Compose, to sign narrowly scoped internal API requests.
This is server authorization, not anonymous access or an IP/forwarded-header admin bypass.

Signatures bind an importer-specific scope, HTTP method, full request target, canonical manifest or
JSON digest, and a fresh timestamp. Authenticate before buffering multipart uploads; verify the
manifest digest afterward and validate EPUB bytes against its checksum before storing them.
The public gateway rejects /api/internal/\*; internal signatures still fail closed if missing,
expired, forged or replayed against another target/body. Existing immutable identities make valid
short-window retries idempotent; this does not provide single-use nonce storage.

Ordinary admin routes, reviews, preview, editing, withdrawal and private data keep Clerk/role checks.
Server imports have no createdByUser relation; their curator note identifies the server operator.
Server publication records reviewer server-operator. Existing processing, public-storage, file
identity, review/deferred-publication and withdrawal-preserving replay rules remain unchanged.

## Consequences

Long batches no longer depend on a short-lived browser token. No additional importer secret or
fake admin account is introduced. Server access grants trusted public import/publication capability;
rotating the existing shared secret revokes it. Browser admin-token import remains supported.
