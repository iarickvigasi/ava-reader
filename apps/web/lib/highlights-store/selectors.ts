// Read paths into the bucket. `selectHighlights` is the canonical merge of
// server snapshot + pending queue; `selectStableHighlights` caches the
// result against the bucket's version so React (via useSyncExternalStore)
// sees referential equality between unrelated renders.

import type { HighlightRecord, StorageBucket } from "./types";

// Computes the merged view (snapshot + pending) the UI renders. Pending
// mutations always win over the server snapshot — they represent the
// user's local intent, which they expect to see reflected immediately.
export function selectHighlights(
  bucket: StorageBucket,
): HighlightRecord[] {
  const byId = new Map<string, HighlightRecord>();
  for (const row of bucket.state.snapshot) {
    byId.set(row.id, row);
  }
  for (const mutation of bucket.state.pending) {
    if (mutation.kind === "delete") {
      byId.delete(mutation.id);
      continue;
    }
    const existing = byId.get(mutation.id);
    const now = mutation.queuedAt;
    byId.set(mutation.id, {
      id: mutation.id,
      excerpt: mutation.payload.excerpt,
      color: mutation.payload.highlightColor,
      locator: mutation.payload.locator,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

// Stable selector for useSyncExternalStore. Re-derives only when `version`
// changed since the last call — otherwise returns the cached array so React
// sees referential equality and skips re-rendering.
export function selectStableHighlights(
  bucket: StorageBucket,
): HighlightRecord[] {
  if (bucket.derivedVersion === bucket.version) {
    return bucket.derived;
  }
  bucket.derived = selectHighlights(bucket);
  bucket.derivedVersion = bucket.version;
  return bucket.derived;
}
