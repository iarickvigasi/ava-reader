// Per-book bucket registry for AI comments. The registry machinery (create,
// hydrate-from-Dexie, subscribe, drain) is shared with the highlights bucket
// in ../shared/bucket-registry; this module wires it to the ai-comments state
// shape and re-exports under the ai-comments-specific names.

import { createBucketRegistry } from "../shared/bucket-registry";
import { readStorage } from "./storage";
import type {
  AiCommentsState,
  DropEvent,
  DropListener,
  Listener,
  StorageBucket,
} from "./types";

export { notifyDrop, persist, trackPersist } from "../shared/bucket-core";

const registry = createBucketRegistry<AiCommentsState, DropEvent, StorageBucket>(
  {
    createInitialState: () => ({ snapshot: [], pending: [] }),
    readStorage,
  },
);

export const getOrCreateBucket = registry.getOrCreateBucket;

export function getAiCommentsBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): StorageBucket {
  return registry.getOrCreateBucket(libraryItemId, apiBaseUrl);
}

export function subscribeToAiComments(
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

// Test-only — drain everything in flight on this bucket.
export async function awaitAiCommentsPersistDrain(
  libraryItemId: string,
): Promise<void> {
  return registry.awaitDrain(libraryItemId);
}

export function __resetAiCommentsBucketsForTests() {
  registry.reset();
}
