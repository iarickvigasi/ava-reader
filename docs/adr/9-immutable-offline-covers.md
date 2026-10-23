# 9. Isolate immutable offline cover bytes

Status: accepted · Related: [[3-offline-first-dexie-buckets]], [[5-per-user-offline-database]].

## Context

Library metadata embeds cover Blobs, so every metadata refresh serializes the existing Blob again.
On the connected iPhone, saved covers returned bytes belonging to other books while retaining their
original sizes. Isolated Safari experiments also reproduced read failures after rendering and
rewriting stored Blobs; the exact original substitution trigger remains unproven.

## Decision

Store cover ArrayBuffers in a separate `bookCovers` table inside the existing per-user database,
keyed by libraryItemId. Metadata rows contain no image bytes. Book-bucket storage owns conversion,
SHA-256 and length validation, guarded writes, and deletion. Only display creates temporary Blobs.
Valid verified covers are immutable; downloads replace missing, invalid, or unverified legacy data.

Schema migration preserves readable, size-consistent legacy covers as unverified bytes and removes
all embedded coverBlob fields atomically. Unreadable or size-inconsistent artwork becomes a cache
miss; chapters, save intent, and mutation queues remain intact. Viewed legacy covers are refreshed
online before being considered verified. A locally calculated legacy hash cannot establish identity.

## Consequences

Metadata updates cannot rewrite artwork. Existing read/download interfaces and account isolation
remain. Cover repair must invalidate warm artwork and notify mounted views. Eviction and library
removal delete the separate cover row in their existing transaction. No server change is required.
