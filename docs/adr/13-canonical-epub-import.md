# ADR 13 · Reimport portable canonical EPUB content

Status: implemented locally; synthetic runtime verified, app qualification pending · 2026-09-29.

## Decision

The existing Library upload recognizes an EPUB declaring AVA's generated profile by its ZIP
entry names after bounded central-directory checks (ZIP64 and split archives are refused). It
stores the upload and same Library item immediately. Ordinary external EPUBs
retain their existing normalizer. A malformed declared profile is refused by its dedicated
preparation path; it never falls back to the lossy external-EPUB parser.

A generated-only processing run owns a new `epub-import-<uuid>` content identity, source file,
owner and Library item. Database-clock leases, random tokens, confirmed lease durations and
monotonic fences serialize
preparation across application instances. Three bounded attempts share a nine-minute deadline.
A process restart can reclaim an expired lease; malformed content is terminal. Temporary
validator failures retry within the same identity and budget. Queue infrastructure failures log a
safe code and back off 2–30 seconds without terminating the API or changing an import outcome.
No PDF job or provider is created.

## Validate and retain

The fixed network-disabled runtime reads the uploaded archive with bounded decompression,
normalized resource paths and duplicate-entry rejection. It validates canonical semantics and
compares actual XHTML, navigation, CSS, package metadata and image bytes with the declared
profile's exact projection. It also runs pinned EPUBCheck 5.4.0. A sidecar or a self-claimed
validation report alone never establishes validity. The profile currently promises exact
compatibility with this exporter version; a future projection change needs versioned handling.

The host validates the returned typed canonical/reader contracts and every artifact hash. A
fresh transaction rechecks source bytes, live attempt and ownership before retaining one
immutable canonical import and its exact reader/resource blobs. Portable source evidence is
content provenance, not a server path, owner, job, or imported publication authority.

Library metadata fills preserve nonempty values and explicit user edits. Language comes from the
validated generated package: its accepted English language claim, or `en` for this English profile
when no accepted language claim exists. This fills the display language without adding a
source-edition metadata claim or changing the immutable canonical content.

## Availability and lifecycle

Validated content can wait for a qualified reader without changing its bytes or final identity.
One atomic acceptance binds a code-approved reader qualification, marks the matching run Ready,
and exposes the reader file. Each read rechecks ownership, required capabilities and hashes.
Generated EPUB and PDF publication use a discriminated canonical reader authority; marks,
translations, progress and offline bytes remain tied to that authority's fixed content identity.

Only authenticated `/library/epub-imports/:importId/resources/:resourceId` routes serve reader
images. A declared cover is bound to its exact retained blob and may appear before reader
qualification through `/library/epub-imports/covers/:libraryItemId`. The Library, details and Home
use that owned URL; the client caches it in the owning account bucket with deletion/abort fences. Embedded URLs cannot direct the client to foreign resources. Public cover routes deny
private imported books, including after owner deletion. Library/account deletion revokes the
owned provenance and resource access; orphan-byte retention follows the scoped storage policy.

See [[../specs/3-library/3.4-import]]. Local contract/runtime checks do not qualify a released
reader, phone behavior, accessibility or offline user flows.
