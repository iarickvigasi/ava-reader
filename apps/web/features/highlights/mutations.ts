// Write paths into the bucket. These are the only functions that should
// append to the pending queue, and the only ones that kick a flush.

import type { ReaderRangeLocator } from "@/lib/api-types";
import { getOrCreateBucket, persist } from "./bucket";
import { flushBucket } from "./sync";
import type { HighlightColor } from "./types";

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
  bucket.state = {
    ...bucket.state,
    pending: [
      ...filtered,
      {
        kind: "upsert",
        id: input.id,
        payload: {
          excerpt: input.excerpt,
          highlightColor: input.color,
          locator: input.locator,
        },
        queuedAt,
      },
    ],
  };
  persist(libraryItemId, bucket);
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
    persist(libraryItemId, bucket);
    return;
  }
  bucket.state = {
    ...bucket.state,
    pending: [
      ...filtered,
      { kind: "delete", id, queuedAt: new Date().toISOString() },
    ],
  };
  persist(libraryItemId, bucket);
  void flushBucket(libraryItemId, apiBaseUrl);
}
