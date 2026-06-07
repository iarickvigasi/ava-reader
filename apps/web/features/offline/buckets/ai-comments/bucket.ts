// Per-book bucket registry for AI comments. Mirrors the structure of the
// highlights bucket so the patterns stay consistent — same subscription
// API, same hydrate-from-Dexie async dance, same trackPersist test helper.

import {
  addDropListener,
  addListener,
  awaitPersistDrain,
  persist,
  setBucketAuth as applyBucketAuth,
} from "../shared/bucket-core";
import { readStorage } from "./storage";
import type { DropListener, Listener, StorageBucket } from "./types";

export { notifyDrop, persist, trackPersist } from "../shared/bucket-core";

const buckets = new Map<string, StorageBucket>();

export function getOrCreateBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  let bucket = buckets.get(libraryItemId);
  if (!bucket) {
    bucket = {
      state: { snapshot: [], pending: [] },
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
  bucket.apiBaseUrl = apiBaseUrl;
  return bucket;
}

async function hydrate(
  libraryItemId: string,
  bucket: StorageBucket,
): Promise<void> {
  try {
    const loaded = await readStorage(libraryItemId);
    // Merge: in-memory state wins (sibling effects may have called
    // applyServerSnapshot or enqueueDelete before hydrate resolved).
    const inMemoryPendingById = new Map(
      bucket.state.pending.map((m) => [m.id, m] as const),
    );
    const mergedPending = [
      ...loaded.pending.filter((m) => !inMemoryPendingById.has(m.id)),
      ...bucket.state.pending,
    ];
    const snapshot = bucket.state.snapshot.length
      ? bucket.state.snapshot
      : loaded.snapshot;
    bucket.state = { snapshot, pending: mergedPending };
    persist(bucket);
  } catch {
    // Dexie unavailable — bucket runs in-memory for this session.
  }
}

export function getAiCommentsBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  return getOrCreateBucket(libraryItemId, apiBaseUrl);
}

export function subscribeToAiComments(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: Listener,
): () => void {
  return addListener(getOrCreateBucket(libraryItemId, apiBaseUrl), listener);
}

export function subscribeToDrops(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: DropListener,
): () => void {
  return addDropListener(
    getOrCreateBucket(libraryItemId, apiBaseUrl),
    listener,
  );
}

export function setBucketAuth(
  libraryItemId: string,
  apiBaseUrl: string,
  getToken: () => Promise<string | null>,
) {
  applyBucketAuth(getOrCreateBucket(libraryItemId, apiBaseUrl), getToken);
}

// Test-only — drain everything in flight on this bucket.
export async function awaitAiCommentsPersistDrain(
  libraryItemId: string,
): Promise<void> {
  return awaitPersistDrain(buckets.get(libraryItemId));
}

export function __resetAiCommentsBucketsForTests() {
  for (const bucket of buckets.values()) {
    if (bucket.retryHandle) {
      clearTimeout(bucket.retryHandle);
    }
  }
  buckets.clear();
}
