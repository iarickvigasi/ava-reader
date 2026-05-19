// Per-book bucket registry. One bucket holds the in-memory state, the
// pending-mutation queue, the listener set, and the latest token-getter for
// background flushes. All other modules in this folder go through these
// helpers so we don't duplicate the "find or hydrate" logic.

import { readStorage, writeStorage } from "./storage";
import type {
  DropEvent,
  DropListener,
  Listener,
  StorageBucket,
} from "./types";

const buckets = new Map<string, StorageBucket>();

// Debounce window for the localStorage write. The in-memory state and the
// subscriber `notify` fire immediately on every mutation; only the
// serialize-and-write hits get coalesced. 100ms is long enough to flatten
// rapid color toggles into one disk write, short enough that a normal user
// can't perceive the gap between "I made a change" and "the page is now
// safe to reload."
const PERSIST_DEBOUNCE_MS = 100;

export function getOrCreateBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  let bucket = buckets.get(libraryItemId);
  if (!bucket) {
    bucket = {
      state: readStorage(libraryItemId),
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
      persistHandle: null,
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

// The one write primitive: bump version (so memoized selectors invalidate),
// notify subscribers, and schedule a *debounced* localStorage write.
// The in-memory state is current immediately; only the serialize/disk hit
// is throttled — that's the expensive part on books with many highlights.
export function persist(libraryItemId: string, bucket: StorageBucket) {
  bucket.version += 1;
  notify(bucket);
  if (bucket.persistHandle) {
    clearTimeout(bucket.persistHandle);
  }
  bucket.persistHandle = setTimeout(() => {
    bucket.persistHandle = null;
    writeStorage(libraryItemId, bucket.state);
  }, PERSIST_DEBOUNCE_MS);
}

// Synchronous flush of any pending debounced write. Called on `pagehide`
// (see useHighlights) so we never lose a write because the user closed the
// tab inside the debounce window.
export function flushPendingPersist(
  libraryItemId: string,
  bucket: StorageBucket,
) {
  if (!bucket.persistHandle) {
    return;
  }
  clearTimeout(bucket.persistHandle);
  bucket.persistHandle = null;
  writeStorage(libraryItemId, bucket.state);
}

// Flush every known bucket's pending persist. Used as the page-unload hook
// when the React tree doesn't have a reference to a specific bucket.
export function flushAllPendingPersists() {
  for (const [libraryItemId, bucket] of buckets) {
    flushPendingPersist(libraryItemId, bucket);
  }
}
