// Shape consumed by the library + collection screens after hydration. Mirrors
// the server's LibraryPayload / LibraryCollectionPayload but with one
// indirection: collections reference book ids (resolved against the
// libraryItems table) instead of nesting books inline. That's what lets a
// single LibraryItemRow survive across collections without duplication.

import type { LibraryCollection } from "@/lib/api-types/library";

export type LibraryView = {
  collections: CollectionView[];
  summary: {
    booksCount: number;
    collectionsCount: number;
  };
};

export type CollectionView = Omit<LibraryCollection, "books"> & {
  books: LibraryBookView[];
};

// What a card needs to render. Drawn from LibraryItemRow but stripped of
// blob/offline-management fields the rendering code doesn't care about.
export type LibraryBookView = {
  libraryItemId: string;
  slug: string;
  title: string;
  authors: string[];
  coverImageUrl: string | null;
  completionPercent: number;
  primaryFormat: string;
  lastReadAt: string | null;
  savedOffline: boolean;
  offlineRequested: boolean;
};

export type LibraryBucketState = {
  view: LibraryView | null;
  // Bumped on every mutation to drive memoization.
  version: number;
};

export type Listener = () => void;
