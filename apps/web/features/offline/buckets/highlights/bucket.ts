// Per-book bucket registry. One bucket holds the in-memory state, the
// pending-mutation queue, the listener set, and the
// latest token-getter for background flushes.

import { readStorage } from "./storage";
import {
  STORAGE_VERSION,
  type DropEvent,
  type DropListener,
  type Listener,
  type StorageBucket,
} from "./types";

const buckets = new Map<string, StorageBucket>();

export function getOrCreateBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  let bucket = buckets.get(libraryItemId);
  if (!bucket) {
    bucket = {
      // Start empty; Dexie hydrate runs in the background and fills the
      // state once available. The bucket's `version` bumps on hydrate so
      // subscribers re-read through the stable selector.
      state: { version: STORAGE_VERSION, snapshot: [], pending: [] },
      listeners: new Set(),
      dropListeners: new Set(),
      flushing: false,
      getToken: null,
      apiBaseUrl,
      version: 1,
      derived: [],
      derivedVersion: 0,
      retryDelayMs: 0,
      retryHandle: null,
      hydratedPromise: Promise.resolve(),
      pendingPersist: Promise.resolve(),
      flushPromise: null,
    };
    buckets.set(libraryItemId, bucket);
    bucket.hydratedPromise = hydrate(libraryItemId, bucket);
  }
  // The apiBaseUrl can shift between server-render and client-render in
  // dev — always keep the latest so flushes target the right host.
  bucket.apiBaseUrl = apiBaseUrl;
  return bucket;
}

async function hydrate(
  libraryItemId: string,
  bucket: StorageBucket,
): Promise<void> {
  try {
    const loaded = await readStorage(libraryItemId);
    // If the caller already mutated the bucket in the brief window before
    // hydrate resolved (e.g. a useHighlights effect dispatched applyServerSnapshot
    // while we were reading Dexie), splice the Dexie pending queue in front
    // of any in-memory pending; deduplicate by highlight id so the in-memory
    // version (newer) wins.
    const inMemoryPendingById = new Map(
      bucket.state.pending.map((mutation) => [mutation.id, mutation] as const),
    );
    const mergedPending = [
      ...loaded.pending.filter(
        (mutation) => !inMemoryPendingById.has(mutation.id),
      ),
      ...bucket.state.pending,
    ];
    // Snapshot: same logic, but the *in-memory* one is preferred when both
    // exist — applyServerSnapshot would have replaced state.snapshot with
    // the freshest server view.
    const snapshot = bucket.state.snapshot.length
      ? bucket.state.snapshot
      : loaded.snapshot;
    bucket.state = {
      version: STORAGE_VERSION,
      snapshot,
      pending: mergedPending,
    };
    persist(libraryItemId, bucket);
  } catch {
    // Dexie unavailable (private mode quirks, quota, …). The bucket keeps
    // working in-memory for this session; we just don't have offline replay.
  }
}

// Public alias — callers outside the folder shouldn't see the
// `getOrCreate` name (it sounds like it might mutate when they only want
// to read), but they should still go through one entry point.
export function getHighlightsBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  return getOrCreateBucket(libraryItemId, apiBaseUrl);
}

export function subscribeToHighlights(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: Listener,
): () => void {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.listeners.add(listener);
  return () => {
    bucket.listeners.delete(listener);
  };
}

export function subscribeToDrops(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: DropListener,
): () => void {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.dropListeners.add(listener);
  return () => {
    bucket.dropListeners.delete(listener);
  };
}

export function setBucketAuth(
  libraryItemId: string,
  apiBaseUrl: string,
  getToken: () => Promise<string | null>,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.getToken = getToken;
}

function notify(bucket: StorageBucket) {
  for (const listener of bucket.listeners) {
    listener();
  }
}

export function notifyDrop(bucket: StorageBucket, event: DropEvent) {
  for (const listener of bucket.dropListeners) {
    listener(event);
  }
}

// Bump version (so memoized selectors invalidate) and notify subscribers.
// Dexie writes are issued by the mutation/sync caller in lockstep; this
// helper deliberately doesn't touch storage anymore.
export function persist(_libraryItemId: string, bucket: StorageBucket) {
  bucket.version += 1;
  notify(bucket);
}

// Chains a fire-and-forget Dexie write onto the bucket's pendingPersist
// promise. Production code voids the return; tests await the bucket's
// pendingPersist via `awaitHighlightsPersistDrain` to make timing
// deterministic.
export function trackPersist(
  bucket: StorageBucket,
  write: () => Promise<unknown>,
): void {
  bucket.pendingPersist = bucket.pendingPersist
    .catch(() => {})
    .then(() => write());
}

// Test-only helper that waits for every in-flight async piece kicked off
// by mutations/sync — the fire-and-forget Dexie write chain *and* any
// currently-running flushBucket — to settle. Loops until both are quiet
// because the flush itself appends more writes to pendingPersist after
// the network roundtrip resolves. Avoids brittle setTimeout polling.
export async function awaitHighlightsPersistDrain(
  libraryItemId: string,
): Promise<void> {
  const bucket = buckets.get(libraryItemId);
  if (!bucket) {
    return;
  }
  // Settle passes: each pass captures the current promise refs, awaits
  // them, then checks whether new work landed. We're quiet when no flush
  // is in flight and the persist chain didn't extend during the await.
  for (let i = 0; i < 10; i++) {
    const persistBefore = bucket.pendingPersist;
    const flush = bucket.flushPromise;
    await bucket.pendingPersist.catch(() => {});
    if (flush) {
      await flush.catch(() => {});
    }
    if (!bucket.flushPromise && bucket.pendingPersist === persistBefore) {
      return;
    }
  }
}

// Test-only — clears module-level state without nuking Dexie.
export function __resetHighlightsBucketsForTests() {
  for (const bucket of buckets.values()) {
    if (bucket.retryHandle) {
      clearTimeout(bucket.retryHandle);
    }
  }
  buckets.clear();
}
