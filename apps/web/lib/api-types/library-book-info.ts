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
