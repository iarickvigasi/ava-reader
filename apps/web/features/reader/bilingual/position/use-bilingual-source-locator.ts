import { useEffect, type RefObject } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderLocator } from "@/lib/api-types";
import { resolveLocatorFromPageIndex } from "@/features/reader/measurement/resolve";
import type { BilingualPage } from "../types";

export function useBilingualSourceLocator(input: {
  sourceRef: RefObject<HTMLElement | null>;
  chapter: BilingualChapter | null;
  page: BilingualPage | null;
  layoutKey: string;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
  rememberOffset: (offset: number) => void;
  disabled: boolean;
}) {
  const {
    sourceRef,
    chapter,
    page,
    layoutKey,
    onVisibleLocatorChange,
    rememberOffset,
    disabled,
  } = input;
  useEffect(() => {
    if (!chapter || !page || disabled) return;
    const frame = requestAnimationFrame(() => {
      const article = sourceRef.current;
      const unit = chapter.units[page.unitIndexes[0]];
      if (!article || !unit) return;
      const found = resolveLocatorFromPageIndex({
        article,
        chapterId: chapter.chapterId,
        columnOffset: 1,
        pageCount: 1,
        pageIndex: 0,
        metrics: {
          columnCount: 1,
          pageBoxLeft: article.getBoundingClientRect().left,
          pageWidth: article.clientWidth,
          pageSpan: article.clientWidth,
        },
      });
      const offset = found
        ? unit.startOffset + found.textOffset
        : Math.max(unit.startOffset, unit.endOffset - 1);
      rememberOffset(offset);
      onVisibleLocatorChange({
        chapterId: chapter.chapterId,
        blockId: unit.blockId,
        textOffset: offset,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    sourceRef,
    chapter,
    page,
    layoutKey,
    onVisibleLocatorChange,
    rememberOffset,
    disabled,
  ]);
}
