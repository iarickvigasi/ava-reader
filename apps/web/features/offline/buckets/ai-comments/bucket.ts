// Per-book bucket registry for AI comments. The registry machinery (create,
// hydrate-from-Dexie, subscribe, drain) is shared with the highlights bucket
// in ../shared/bucket-registry; this module wires it to the ai-comments state
// shape and re-exports under the ai-comments-specific names.

import { createBucketRegistry } from "../shared/bucket-registry";
import { readStorage } from "./storage";
import type {
  AiCommentRecord,
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

// SSR / pre-hydration snapshot for useSyncExternalStore. Must return the
// same reference on every call — React (DEV) invokes it twice per hydration
// render and logs "getServerSnapshot should be cached" on a fresh array
// (see use-highlights.ts for the same guard on the highlights side).
const EMPTY_SERVER_SNAPSHOT: AiCommentRecord[] = [];

export function getAiCommentsServerSnapshot(): AiCommentRecord[] {
  return EMPTY_SERVER_SNAPSHOT;
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
