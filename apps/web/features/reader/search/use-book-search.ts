import { useEffect, useState } from "react";
import type { BookSearchResult, SearchChapter } from "./types";
import { searchChapter } from "./search-chapter";

const DEBOUNCE_MS = 200;
export function useBookSearch(
  chapters: SearchChapter[],
  query: string,
  enabled: boolean,
) {
  const [state, setState] = useState({
    chapters: null as SearchChapter[] | null,
    results: [] as BookSearchResult[],
    pending: false,
    query: "",
  });
  useEffect(() => {
    if (!enabled || !query.trim()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const results: BookSearchResult[] = [];
    let index = 0;
    function scan() {
      if (cancelled) return;
      if (index < chapters.length)
        results.push(...searchChapter(chapters[index++], query));
      const pending = index < chapters.length;
      setState({ chapters, results: [...results], pending, query });
      if (pending) timer = setTimeout(scan, 0);
    }
    timer = setTimeout(scan, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chapters, query, enabled]);
  if (!query.trim()) return { results: [], pending: false };
  return state.query === query && state.chapters === chapters
    ? state
    : { results: [], pending: true };
}
