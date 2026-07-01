// Shared server-sync runtime for the offline buckets (highlights,
// ai-comments). The queue-drain loop is identical across buckets: claim the
// single in-flight slot synchronously, await Dexie hydrate, then drain the
// pending queue head-first — one mutation in flight at a time so the server
// sees them in order. Retryable outcomes bump the backoff and reschedule;
// terminal outcomes pop the head and continue.
//
// Two things differ per bucket and are supplied as deps:
//   - `send` — the actual network call + on-wire shape, returning a tagged
//     Result. The `"retry"` kind is the shared sentinel the loop watches for.
//   - `applyTerminal` — how a non-retry Result updates the snapshot (and any
//     snapshot-row Dexie write / drop notification). Returns the next snapshot.
//
// `applyServerSnapshot` is shared too, with a `toRecords` mapper for the one
// bucket (ai-comments) that decorates server rows before storing them.

import {
  cancelRetry,
  persist,
  scheduleRetry,
  trackPersist,
} from "./bucket-core";

// Structural shape of a bucket the loop touches — the full StorageBucket of
// each bucket satisfies it.
type FlushBucket<Row, Mutation> = {
  state: { snapshot: Row[]; pending: Mutation[] };
  flushing: boolean;
  getToken: (() => Promise<string | null>) | null;
  apiBaseUrl: string;
  version: number;
  listeners: Set<() => void>;
  retryDelayMs: number;
  retryHandle: ReturnType<typeof setTimeout> | null;
  hydratedPromise: Promise<void>;
  pendingPersist: Promise<unknown>;
  flushPromise: Promise<void> | null;
};

type SyncDeps<Row, Mutation, Result extends { kind: string }, Input, Bucket> = {
  getOrCreateBucket: (libraryItemId: string, apiBaseUrl: string) => Bucket;
  // The network call for one mutation. Returns `{kind:"retry"}` to reschedule,
  // or any other tagged Result the bucket's `applyTerminal` knows how to apply.
  send: (
    bucket: Bucket,
    libraryItemId: string,
    head: Mutation,
    token: string,
  ) => Promise<Result>;
  // Apply a terminal (non-retry) result: mutate the snapshot, queue any
  // snapshot-row Dexie write, fire drop notifications. Returns the next
  // snapshot; the loop handles popping the head + removing the pending row.
  applyTerminal: (
    bucket: Bucket,
    libraryItemId: string,
    head: Mutation,
    result: Result,
  ) => Row[];
  removePendingMutation: (id: string) => Promise<unknown>;
  // Maps a fresh GET payload into stored records (identity for highlights;
  // ai-comments stamps status/error).
  toRecords: (snapshot: Input[]) => Row[];
  replaceSnapshot: (libraryItemId: string, records: Row[]) => Promise<unknown>;
};

export function createSyncRuntime<
  Row,
  Mutation extends { id: string },
  Result extends { kind: string },
  Input,
  Bucket extends FlushBucket<Row, Mutation>,
>(deps: SyncDeps<Row, Mutation, Result, Input, Bucket>) {
  const {
    getOrCreateBucket,
    send,
    applyTerminal,
    removePendingMutation,
    toRecords,
    replaceSnapshot,
  } = deps;

  // Replaces the server snapshot from a fresh GET. Pending mutations are kept
  // — they may not have been acked yet.
  function applyServerSnapshot(
    libraryItemId: string,
    apiBaseUrl: string,
    snapshot: Input[],
  ): void {
    const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
    const records = toRecords(snapshot);
    bucket.state = { ...bucket.state, snapshot: records };
    persist(bucket);
    // Mirror the new authoritative snapshot to Dexie. Async; the in-memory
    // state is already current for any synchronous read.
    trackPersist(bucket, () => replaceSnapshot(libraryItemId, records));
  }

  function flushBucket(
    libraryItemId: string,
    apiBaseUrl: string,
  ): Promise<void> {
    const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
    if (bucket.flushing) {
      return Promise.resolve();
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return Promise.resolve();
    }
    if (!bucket.getToken) {
      return Promise.resolve();
    }
    // Claim the in-flight slot *synchronously* before any await — otherwise a
    // second flushBucket call (e.g. the implicit one inside an enqueue) would
    // pass the early-return above and we'd send the same head twice.
    bucket.flushing = true;
    // Expose the in-flight promise on the bucket so tests can await it
    // deterministically. Production code never reads it.
    const work = doFlush(libraryItemId, bucket);
    bucket.flushPromise = work.finally(() => {
      bucket.flushPromise = null;
    });
    return bucket.flushPromise;
  }

  async function doFlush(
    libraryItemId: string,
    bucket: Bucket,
  ): Promise<void> {
    // Now safe to await Dexie hydrate: a restored queue + an in-memory enqueue
    // can't be double-sent because the only path into this block is gated by
    // `flushing = true` set above.
    await bucket.hydratedPromise;
    cancelRetry(bucket);
    const getToken = bucket.getToken;
    if (!getToken) {
      bucket.flushing = false;
      return;
    }
    try {
      while (bucket.state.pending.length > 0) {
        const head = bucket.state.pending[0]!;
        const token = await getToken();
        if (!token) {
          // Transient null token (e.g. Clerk refresh in flight). Reschedule so
          // the queue isn't stranded until the next online/visibility event.
          scheduleRetry(bucket, () =>
            void flushBucket(libraryItemId, bucket.apiBaseUrl),
          );
          return;
        }
        const result = await send(bucket, libraryItemId, head, token);
        if (result.kind === "retry") {
          scheduleRetry(bucket, () =>
            void flushBucket(libraryItemId, bucket.apiBaseUrl),
          );
          return;
        }
        // Pop the acked head by *identity*, reading the queue fresh: a
        // coalescing enqueue during the await may have moved `head` to the
        // tail (replacing it with a newer edit at the same id). A positional
        // pop (slice(1)) would drop a different, never-sent mutation; filtering
        // by reference removes exactly what we sent and keeps any replacement.
        const popped = bucket.state.pending.filter((m) => m !== head);
        const nextSnapshot = applyTerminal(bucket, libraryItemId, head, result);
        // Whatever the outcome (success / drop), the head mutation leaves the
        // queue. Mirror that to Dexie.
        trackPersist(bucket, () => removePendingMutation(head.id));
        bucket.state = {
          ...bucket.state,
          snapshot: nextSnapshot,
          pending: popped,
        };
        persist(bucket);
        // We made progress (or cleanly discarded) — reset backoff so the next
        // transient blip doesn't inherit the previous run's long delay.
        bucket.retryDelayMs = 0;
      }
    } finally {
      bucket.flushing = false;
    }
  }

  return { applyServerSnapshot, flushBucket };
}
