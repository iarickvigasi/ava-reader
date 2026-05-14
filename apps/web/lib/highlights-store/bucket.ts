// Per-book bucket registry. One bucket holds the in-memory state, the
// pending-mutation queue, the listener set, and the latest token-getter for
// background flushes. All other modules in this folder go through these
// helpers so we don't duplicate the "find or hydrate" logic.

import { readStorage, writeStorage } from "./storage";
import type { Listener, StorageBucket } from "./types";

const buckets = new Map<string, StorageBucket>();

export function getOrCreateBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  let bucket = buckets.get(libraryItemId);
  if (!bucket) {
    bucket = {
      state: readStorage(libraryItemId),
      listeners: new Set(),
      flushing: false,
      getToken: null,
      apiBaseUrl,
      version: 1,
      derived: [],
      derivedVersion: 0,
    };
    buckets.set(libraryItemId, bucket);
  }
  // The apiBaseUrl can shift between server-render and client-render in
  // dev — always keep the latest so flushes target the right host.
  bucket.apiBaseUrl = apiBaseUrl;
  return bucket;
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

// The one write primitive: bump version (so memoized selectors invalidate),
// persist to localStorage, and notify subscribers. Every mutation goes
// through here.
export function persist(libraryItemId: string, bucket: StorageBucket) {
  bucket.version += 1;
  writeStorage(libraryItemId, bucket.state);
  notify(bucket);
}
