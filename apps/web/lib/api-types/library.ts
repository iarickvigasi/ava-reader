import type { BookFileFormat } from "./shared";

export type LibraryCollectionBook = {
  authors: string[];
  completionPercent: number;
  coverImageUrl: string | null;
  lastReadAt: string;
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
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

export type LibraryBookInfo = {
  addedAt: string;
  approximatePageCount: number | null;
  authors: string[];
  chapterLabel: string | null;
  collections: Array<{
    id: string;
    kind: "SMART" | "CUSTOM";
    name: string;
    smartKey: string | null;
  }>;
  completionPercent: number;
  coverImageUrl: string | null;
  description: string | null;
  genres: string[];
  language: string | null;
  lastReadAt: string | null;
  libraryItemId: string;
  minutesRead: number;
  primaryFormat: BookFileFormat;
  publishedYear: number | null;
  slug: string;
  source: "IMPORTED" | "CATALOG";
  title: string;
};

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
