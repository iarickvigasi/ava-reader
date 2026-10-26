import { useEffect, useMemo, useState } from "react";
import { observeSearchContent } from "@/features/offline/buckets/book";
import type { BookRow, ChapterRow } from "@/features/offline/db";
import type { ReaderChapterPayload, ReaderTocNode } from "@/lib/api-types";
import { sameSearchCache } from "./same-search-cache";
import { mergeSearchContent } from "./merge-search-content";

type Cache = { book?: BookRow; chapters: ChapterRow[]; error: boolean };
export function useSearchContent(
  libraryItemId: string,
  toc: ReaderTocNode[],
  window: ReaderChapterPayload[],
) {
  // Freeze the reader window while the panel is open; cache arrivals remain live.
  const [opening] = useState(() => ({ toc, window }));
  const [cache, setCache] = useState<Cache>({ chapters: [], error: false });
  useEffect(() => {
    const subscription = observeSearchContent(libraryItemId).subscribe({
      next: (snapshot) =>
        setCache((previous) =>
          !previous.error && sameSearchCache(previous, snapshot)
            ? previous
            : { ...snapshot, error: false },
        ),
      error: () => setCache({ chapters: [], error: true }),
    });
    return () => subscription.unsubscribe();
  }, [libraryItemId]);
  return useMemo(
    () => mergeSearchContent(cache, opening.toc, opening.window),
    [cache, opening],
  );
}
