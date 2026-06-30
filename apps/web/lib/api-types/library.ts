import type { BookFileFormat } from "./shared";

// Shared between every screen that shows a book card: the library, a
// collection, the home "currently reading" widget. Anything that knows a book
// at all knows at least this much. Subtypes add screen-specific extras.
export type LibraryCardBook = {
  authors: string[];
  completionPercent: number;
  coverImageUrl: string | null;
  libraryItemId: string;
  // Server-synced "keep this book available offline" intent (see
  // specs/12-offline-save-sync). Optional because only the library payloads
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
  collections: LibraryCollection[];
  summary: {
    booksCount: number;
    collectionsCount: number;
  };
};

export type LibraryCollectionPayload = {
  collection: LibraryCollection;
};

// Detail-only fields — what the book-info screen needs ON TOP of the card.
// Composed with `LibraryCardBook` they reconstitute `LibraryBookInfo`; the
// book-info payload (`GET /api/library/:slug`) carries both halves together.
//
// `lastReadAt` here is the strict ReadingProgress.lastReadAt (nullable if the
// user has never opened the book) — distinct from the card's "engagement"
// timestamp, which is why it lives on the details side, not the card.
export type LibraryBookInfoDetails = {
  addedAt: string;
  approximatePageCount: number | null;
  chapterLabel: string | null;
  collections: Array<{
    id: string;
    kind: "SMART" | "CUSTOM";
    name: string;
    smartKey: string | null;
  }>;
  description: string | null;
  genres: string[];
  language: string | null;
  lastReadAt: string | null;
  minutesRead: number;
  publishedYear: number | null;
  source: "IMPORTED" | "CATALOG";
};

export type LibraryBookInfo = LibraryCardBook & LibraryBookInfoDetails;

export type LibraryBookInfoPayload = {
  book: LibraryBookInfo;
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
