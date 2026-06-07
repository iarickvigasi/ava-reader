// Write paths. enqueueGenerate / enqueueDelete are the only functions that
// append to the pending queue, and the only ones that kick a flush.
//
// Same coalesce rule as highlights: at most one pending mutation per id at
// a time. A delete for an id that has only a queued generate (never reached
// the server) collapses both — nothing to send.

import { getOrCreateBucket, persist, trackPersist } from "./bucket";
import {
  removePendingMutation,
  upsertPendingMutation,
} from "./storage";
import { flushBucket } from "./sync";
import type { PendingMutation } from "./types";

export function enqueueGenerate(
  libraryItemId: string,
  apiBaseUrl: string,
  mutation: Extract<
    PendingMutation,
    {
      kind:
        | "generate.translate"
        | "generate.etymology"
        | "generate.explain";
    }
  >,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  // Coalesce against any existing pending row with the same id.
  const filtered = bucket.state.pending.filter((m) => m.id !== mutation.id);
  bucket.state = {
    ...bucket.state,
    pending: [...filtered, mutation],
  };
  persist(bucket);
  trackPersist(bucket, () => upsertPendingMutation(libraryItemId, mutation));
  void flushBucket(libraryItemId, apiBaseUrl);
}

export function enqueueDelete(
  libraryItemId: string,
  apiBaseUrl: string,
  id: string,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  // If the row has never been synced (only exists as a queued generate),
  // collapse to nothing — there's nothing on the server to delete.
  const everSynced = bucket.state.snapshot.some((row) => row.id === id);
  const filtered = bucket.state.pending.filter((m) => m.id !== id);
  if (!everSynced) {
    bucket.state = { ...bucket.state, pending: filtered };
    persist(bucket);
    trackPersist(bucket, () => removePendingMutation(id));
    return;
  }
  const next: PendingMutation = {
    kind: "delete",
    id,
    queuedAt: new Date().toISOString(),
  };
  bucket.state = { ...bucket.state, pending: [...filtered, next] };
  persist(bucket);
  trackPersist(bucket, () => upsertPendingMutation(libraryItemId, next));
  void flushBucket(libraryItemId, apiBaseUrl);
}
