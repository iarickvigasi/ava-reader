import { viewsEqual } from "./views-equal";
import type {
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";
import { liveQuery, type Subscription } from "dexie";
import type { CompletionWriteOptions } from "../../completion/state";

export { readBookInfoBySlug as readBookInfo } from "./book-info/read-book-info";
import { readLibraryView } from "./collections/read-library";
import {
  applyCollectionPayload,
  applyLibraryPayload,
  type LibraryWriteOptions,
} from "./collections/write-library";
export { applyBookInfoPayload as hydrateBookInfo } from "./book-info/write-book-info";
import type { LibraryBucketState, LibraryView, Listener } from "./types";

const state: LibraryBucketState = { view: null, version: 0 };

const listeners = new Set<Listener>();
let subscription: Subscription | undefined;

function notify() {
  state.version += 1;
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (!subscription)
    subscription = liveQuery(readLibraryView).subscribe({
      next: updateView,
      error: () => {
        subscription = undefined;
      },
    });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      subscription?.unsubscribe();
      subscription = undefined;
    }
  };
}

export function getLibrarySnapshot(): LibraryView | null {
  return state.view;
}

export function getServerSnapshot(): LibraryView | null {
  return null;
}

export async function refreshFromDb(): Promise<void> {
  const next = await readLibraryView();
  updateView(next);
}

function updateView(next: LibraryView | null) {
  if (viewsEqual(state.view, next)) return;
  state.view = next;
  notify();
}

export async function hydrateFromPayload(
  payload: LibraryPayload,
  options: LibraryWriteOptions = {},
): Promise<void> {
  await applyLibraryPayload(payload, {
    ...options,
    canRemove: options.expectedCompletionRevision !== undefined,
  });
  await refreshFromDb();
}

export async function hydrateCollection(
  collection: LibraryCollection,
  options: CompletionWriteOptions = {},
): Promise<void> {
  await applyCollectionPayload(collection, false, options.db, options);
  await refreshFromDb();
}

export { readCollectionViewBySlug as readCollectionBySlug } from "./collections/read-library";

export function __resetLibraryBucketForTests() {
  subscription?.unsubscribe();
  subscription = undefined;
  state.view = null;
  state.version = 0;
  listeners.clear();
}
