// Write paths into the bucket. These are the only functions that should
// append to the pending queue, and the only ones that kick a flush.
//
// Each call updates the in-memory state synchronously (so the UI repaints
// immediately), then mirrors the change to Dexie. The Dexie write is
// fire-and-forget — a failure leaves the in-memory state untouched and the
// next mutation overwrites the row anyway. The flush is also fire-and-forget
// (the bucket awaits its `hydratedPromise` internally before sending so a
// queue restored from a previous session doesn't get double-sent).

import type { ReaderRangeLocator } from "@/lib/api-types";

import { getOrCreateBucket, persist, trackPersist } from "./bucket";
import {
  removePendingMutation,
  upsertPendingMutation,
} from "./storage";
import { flushBucket } from "./sync";
import type { HighlightColor, PendingMutation } from "./types";

export function enqueueUpsert(
  libraryItemId: string,
  apiBaseUrl: string,
  input: {
    id: string;
    excerpt: string;
    color: HighlightColor;
    locator: ReaderRangeLocator | null;
  },
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  const queuedAt = new Date().toISOString();
  // Coalesce: if we already have a pending mutation for this id, replace it.
  // We only ever need to send the *final* state to the server.
  const filtered = bucket.state.pending.filter(
    (mutation) => mutation.id !== input.id,
  );
  const next: PendingMutation = {
    kind: "upsert",
    id: input.id,
    payload: {
      excerpt: input.excerpt,
      highlightColor: input.color,
      locator: input.locator,
    },
    queuedAt,
  };
  bucket.state = {
    ...bucket.state,
    pending: [...filtered, next],
  };
  persist(bucket);
  // Mirror to Dexie. mutationId == highlightId so put() coalesces with any
  // prior row for the same highlight automatically.
  trackPersist(bucket, () => upsertPendingMutation(libraryItemId, next));
  void flushBucket(libraryItemId, apiBaseUrl);
}

export function enqueueDelete(
  libraryItemId: string,
  apiBaseUrl: string,
  id: string,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  // If the row has never been synced (only exists in pending as an upsert),
  // we can drop both the upsert and the delete — there's nothing to delete
  // on the server.
  const everSynced = bucket.state.snapshot.some((row) => row.id === id);
  const filtered = bucket.state.pending.filter(
    (mutation) => mutation.id !== id,
  );
  if (!everSynced) {
    bucket.state = { ...bucket.state, pending: filtered };
    persist(bucket);
    // Whatever upsert was queued, scrub it from Dexie too.
    trackPersist(bucket, () => removePendingMutation(id));
    return;
  }
  const next: PendingMutation = {
    kind: "delete",
    id,
    queuedAt: new Date().toISOString(),
  };
  bucket.state = {
    ...bucket.state,
    pending: [...filtered, next],
  };
  persist(bucket);
  trackPersist(bucket, () => upsertPendingMutation(libraryItemId, next));
  void flushBucket(libraryItemId, apiBaseUrl);
}
