// In-memory bucket for the library + collections view. Bridges Dexie (slow,
// async, one source of truth) and React (fast, sync useSyncExternalStore
// reads).

import type {
  LibraryBookInfo,
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";

import {
  applyBookInfoPayload,
  applyCollectionPayload,
  applyLibraryPayload,
  readBookInfoBySlug,
  readCollectionViewBySlug,
  readLibraryView,
} from "./storage";
import type {
  CollectionView,
  LibraryBucketState,
  LibraryView,
  Listener,
} from "./types";

const state: LibraryBucketState = {
  view: null,
  version: 0,
};

const listeners = new Set<Listener>();

function notify() {
  state.version += 1;
  for (const listener of listeners) {
    listener();
  }
}

// React subscription primitive used by useSyncExternalStore.
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLibrarySnapshot(): LibraryView | null {
  return state.view;
}

// SSR snapshot — always null. The first client effect hydrates the bucket
// from Dexie (and falls back to the RSC payload) before any state-dependent
// render happens.
export function getServerSnapshot(): LibraryView | null {
  return null;
}

// Pulls the latest view from Dexie into memory. Safe to call repeatedly;
// notifies listeners only when the view actually changes.
export async function refreshFromDb(): Promise<void> {
  const next = await readLibraryView();
  if (viewsEqual(state.view, next)) {
    return;
  }
  state.view = next;
  notify();
}

// Hydrates the bucket from a server payload received via RSC. Writes to
// Dexie + updates memory. The caller (a client island sibling of the RSC
// page) hands us the same payload Next gave the server component, so the
// first paint and the hydrated state agree.
export async function hydrateFromPayload(payload: LibraryPayload): Promise<void> {
  await applyLibraryPayload(payload);
  await refreshFromDb();
}

// Same but for a single collection.
export async function hydrateCollection(
  collection: LibraryCollection,
): Promise<void> {
  await applyCollectionPayload(collection);
  await refreshFromDb();
}

export async function readCollectionBySlug(
  slug: string,
): Promise<CollectionView | null> {
  return readCollectionViewBySlug(slug);
}

// ----- book-info -------------------------------------------------------------
// Phase 1 also caches the book-info screen's data so the user can re-open
// the page offline. Unlike the library/collection views, this isn't held in
// the in-memory bucket — the screen reads through Dexie on demand. Keeping
// it out of the bucket avoids broadcasting unrelated updates to library
// subscribers every time the user opens a book's info page.

export async function hydrateBookInfo(book: LibraryBookInfo): Promise<void> {
  await applyBookInfoPayload(book);
  // No `refreshFromDb()` here — book-info changes don't alter the
  // library/collection list, so library subscribers don't need a notify.
}

export async function readBookInfo(slug: string) {
  return readBookInfoBySlug(slug);
}

// ----- equality --------------------------------------------------------------
// Shallow + structural enough that "same data fetched twice in a row" doesn't
// thrash subscribers. We compare collection ids + book ids + visible cardinal
// fields; offline-only fields (savedOffline) get their own version bump path
// in phase 2.

function viewsEqual(a: LibraryView | null, b: LibraryView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.summary.booksCount !== b.summary.booksCount) return false;
  if (a.summary.collectionsCount !== b.summary.collectionsCount) return false;
  if (a.collections.length !== b.collections.length) return false;
  for (let i = 0; i < a.collections.length; i += 1) {
    const ca = a.collections[i];
    const cb = b.collections[i];
    if (ca.id !== cb.id) return false;
    if (ca.name !== cb.name) return false;
    if (ca.unreadCount !== cb.unreadCount) return false;
    if (ca.itemCount !== cb.itemCount) return false;
    if (ca.books.length !== cb.books.length) return false;
    for (let j = 0; j < ca.books.length; j += 1) {
      const ba = ca.books[j];
      const bb = cb.books[j];
      if (ba.libraryItemId !== bb.libraryItemId) return false;
      if (ba.completionPercent !== bb.completionPercent) return false;
      if (ba.lastReadAt !== bb.lastReadAt) return false;
      if (ba.savedOffline !== bb.savedOffline) return false;
    }
  }
  return true;
}

// Test-only: reset the in-memory state. Does NOT touch Dexie — pair with
// __resetDbForTests() in db.ts.
export function __resetLibraryBucketForTests() {
  state.view = null;
  state.version = 0;
  listeners.clear();
}
