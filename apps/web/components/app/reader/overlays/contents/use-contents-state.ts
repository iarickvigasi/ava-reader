import { useMemo } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
} from "@/features/reader/toc";
import type { ReadyReaderTocEntry } from "../../shared/types";

export function useContentsState(
  toc: ReadyReaderTocEntry[],
  chapterId: string,
  locator: ReaderLocator | null,
) {
  return useMemo(() => {
    const path = findActiveTocPathIds(toc, {
      activeBlockId: locator?.blockId ?? null,
      activeChapterId: chapterId,
    });
    return {
      activePathIds: new Set(path),
      currentEntryId: path.at(-1) ?? null,
      chapterCount: countUniqueTocChapters(toc),
    };
  }, [toc, chapterId, locator?.blockId]);
}
