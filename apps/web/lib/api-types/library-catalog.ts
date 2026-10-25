import type { LibraryBookInfo } from "./library-book-info";
import type { BookFileFormat } from "./shared";

export type CompletionItem = {
  libraryItemId: string;
  finishedAt: string | null;
  completionPercent: number;
};

// Shared between every screen that shows a book card: the library, a
// collection, the home "currently reading" widget. Anything that knows a book
// at all knows at least this much. Subtypes add screen-specific extras.
export type LibraryCardBook = {
  authors: string[];
  completionPercent: number;
  // Older list payloads can omit the finish date; null explicitly clears it.
  finishedAt?: string | null;
  coverImageUrl: string | null;
  libraryItemId: string;
  // Server-synced "keep this book available offline" intent (see
  // specs/4-offline/4.2-save-sync). Optional because only the library payloads
  // populate it; home/catalog/reader cards omit it.
  offlineRequested?: boolean;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

// `lastReadAt` here means "most recent engagement" — max of progress.lastReadAt,
// LibraryItem.lastOpenedAt, and addedAt. Always present because every active
// item has at least an addedAt. This drives card sort order.
export type LibraryCollectionBook = LibraryCardBook & {
  lastReadAt: string;
};

export type LibraryCollection = {
  books: LibraryCollectionBook[];
  completionItems?: CompletionItem[];
  description: string | null;
  id: string;
  itemCount: number;
  kind: "SMART" | "CUSTOM";
  name: string;
  slug: string;
  smartKey: string | null;
  unreadCount: number;
};

export type LibraryPayload = {
  // Complete active card catalog, independent of collection previews. Legacy caches omit it.
  books?: LibraryCollectionBook[];
  // Complete server identity set. Omitted by older servers; previews never imply deletion.
  libraryItemIds?: string[];
  collections: LibraryCollection[];
  summary: {
    booksCount: number;
    collectionsCount: number;
  };
};

export type LibraryCollectionPayload = {
  collection: LibraryCollection;
};

export type LibraryCollectionRenamePayload = {
  collectionId: string;
  description: string | null;
  name: string;
};

export type LibraryCollectionDeletePayload = {
  collectionId: string;
  state: "deleted";
};

export type LibraryBookCollectionsInput = {
  libraryItemId: string;
  addCollectionIds: string[];
  removeCollectionIds: string[];
};

export type LibraryBookCollectionsPayload = {
  libraryItemId: string;
  collections: LibraryBookInfo["collections"];
  affectedCollections: LibraryCollection[];
};
