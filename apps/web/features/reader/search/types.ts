import type { ReaderBlock, ReaderRangeLocator } from "@/lib/api-types";

export type SearchChapter = {
  chapterId: string;
  blocks: ReaderBlock[];
  order: number;
  label: string;
};
export type SearchMatch = { start: number; end: number };
export type BookSearchResult = {
  id: string;
  text: string;
  chapterLabel: string;
  locator: ReaderRangeLocator;
  matchOffset: number;
  matches: SearchMatch[];
};
export type SearchTarget = { result: BookSearchResult; requestId: number };
