import type { LibraryCardBook } from "./library-catalog";

// Detail-only fields — what the book-info screen needs ON TOP of the card.
// Composed with `LibraryCardBook` they reconstitute `LibraryBookInfo`; the
// book-info payload (`GET /api/library/:slug`) carries both halves together.
//
// `lastReadAt` here is the strict ReadingProgress.lastReadAt (nullable if the
// user has never opened the book) — distinct from the card's "engagement"
// timestamp, which is why it lives on the details side, not the card.
export type LibraryBookInfoDetails = {
  addedAt: string;
  // Pages of countable prose, from the chapter-purpose analysis — notes,
  // references and contents pages excluded. Null until a book is analysed,
  // in which case reading time falls back to `approximatePageCount`.
  approximateBodyPageCount: number | null;
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
  // Explicitly recorded completion date, independent of reading progress.
  finishedAt: string | null;
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
