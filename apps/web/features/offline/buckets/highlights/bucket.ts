// Per-book bucket registry. One bucket holds the in-memory state, the
// pending-mutation queue, the listener set, and the latest token-getter for
// background flushes. The registry machinery (create, hydrate-from-Dexie,
// subscribe, drain) is shared with the other offline buckets in
// ../shared/bucket-registry; this module just wires it to the highlights
// state shape and re-exports under the highlights-specific names.

import { createBucketRegistry } from "../shared/bucket-registry";
import { readStorage } from "./storage";
import {
  STORAGE_VERSION,
  type DropEvent,
  type DropListener,
  type HighlightsState,
  type Listener,
  type StorageBucket,
} from "./types";

export { notifyDrop, persist, trackPersist } from "../shared/bucket-core";

const registry = createBucketRegistry<HighlightsState, DropEvent, StorageBucket>(
  {
    createInitialState: () => ({
      version: STORAGE_VERSION,
      snapshot: [],
      pending: [],
    }),
    readStorage,
  },
);

export const getOrCreateBucket = registry.getOrCreateBucket;

// Public alias — callers outside the folder shouldn't see the
// `getOrCreate` name (it sounds like it might mutate when they only want
// to read), but they should still go through one entry point.
export function getHighlightsBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  return registry.getOrCreateBucket(libraryItemId, apiBaseUrl);
}

export function subscribeToHighlights(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: Listener,
): () => void {
  return registry.subscribe(libraryItemId, apiBaseUrl, listener);
}

export function subscribeToDrops(
  libraryItemId: string,
  apiBaseUrl: string,
  listener: DropListener,
): () => void {
  return registry.subscribeToDrops(libraryItemId, apiBaseUrl, listener);
}

export function setBucketAuth(
  libraryItemId: string,
  apiBaseUrl: string,
  getToken: () => Promise<string | null>,
) {
  registry.setBucketAuth(libraryItemId, apiBaseUrl, getToken);
}

// Test-only helper that waits for every in-flight async piece kicked off
// by mutations/sync — the fire-and-forget Dexie write chain *and* any
// currently-running flushBucket — to settle.
export async function awaitHighlightsPersistDrain(
  libraryItemId: string,
): Promise<void> {
  return registry.awaitDrain(libraryItemId);
}

// Test-only — clears module-level state without nuking Dexie.
export function __resetHighlightsBucketsForTests() {
  registry.reset();
}
