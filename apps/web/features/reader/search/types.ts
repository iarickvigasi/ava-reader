import type { ReaderLocator } from "@/lib/api-types/reader";

export type SearchPassage = ReaderLocator & {
  text: string;
  chapterLabel: string;
};
export type SearchHit = SearchPassage & { endOffset: number };
export type SearchResults = { hits: SearchHit[]; truncated: boolean };
export const MAX_SEARCH_RESULTS = 100;
export const MAX_SEARCH_CHARACTERS = 20_000_000;
export const MAX_SEARCH_PASSAGES = 100_000;
export const MAX_SEARCH_CHAPTERS = 10_000;
export const MAX_SEARCH_QUERY = 256;
