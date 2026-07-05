# 3. Offline-first via Dexie + bucket pattern

Status: accepted

## Context
A reading app must work on planes, subways, and flaky networks. Reads and annotations cannot block
on the server. We needed one consistent way to handle local state + sync across many domains.

## Decision
Client state lives in IndexedDB (Dexie). Every user-mutable domain is a "bucket": in-memory
snapshot + pending mutation queue, persisted to Dexie, flushed idempotently to the API on reconnect
(client-generated ULIDs, keyed upserts, exponential retry). Cached read-only payloads (book,
library, home, me) use the same container without a write queue.

## Consequences
- Instant UI; survives offline and reload. Sync is uniform and testable (fake-indexeddb).
- Cost: every domain reimplements the fixed bucket file set; conflict resolution is last-write-wins,
  not CRDT.
- Hard to reverse: data shapes, ULID idempotency, and the API contract are coupled to this model.
