# 11. Private Book ownership and quarantine

Status: accepted · Date: 2026-10-27 · Scope: private imports and shared catalog content.

## Context

LibraryItem ownership alone is insufficient: the local audit found three imported Books linked
into two users' libraries. A user's own LibraryItem must not authorize another user's private file.
Book currently has no durable privacy classification; removing a membership can change inferred access.

## Decision

- Book visibility defaults to PRIVATE. Private imports record the authenticated uploader as
  privateOwnerId in the same transaction that creates the Book and LibraryItem.
- PUBLIC marks shared catalog content, not worldwide rights clearance or anonymous file access.
  Catalog upload creates a fresh PUBLIC Book; it never promotes an existing private upload.
- Access requires the caller's LibraryItem and either PUBLIC visibility or matching privateOwnerId.
  Apply this to metadata, covers, reader packages, AI/annotations, and library/collection projections.
- Backfill ownership only when existing IMPORTED memberships identify exactly one user.
  Conflicting/missing ownership stays PRIVATE with no owner: quarantine, denying all reader access.
  Restore an owner only after provenance review; preserve Books, files, memberships, and reading data.
- Existing catalog Books without private-import memberships become PUBLIC. Any catalog pointer to
  a private Book fails publication/acquisition/discovery checks. Unpublishing public content does
  not revoke an already acquired LibraryItem.
- Opt-in Connect sharing may expose title and authors of an owned private Book. It never grants
  access to covers, files, annotations, progress, or other private records.

## Consequences

Quarantined legacy Books disappear from reading and discovery until reviewed. This deliberately
prefers withholding access over guessing an owner. Previously downloaded bytes cannot be remotely
recalled; existing account-isolated cache pruning removes withdrawn items during revalidation.
