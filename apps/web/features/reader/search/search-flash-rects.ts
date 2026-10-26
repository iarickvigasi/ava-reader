import type { BookSearchResult } from "./types";
import { blockTextRange } from "./block-text-range";

export function searchFlashRects(root: HTMLElement, result: BookSearchResult) {
  let matchVisible = false;
  const rects: { left: number; top: number; width: number; height: number }[] =
    [];
  for (const viewport of root.querySelectorAll<HTMLElement>(
    "[data-reader-page-viewport]",
  )) {
    if (viewport.querySelector("[data-reader-text-skeleton]")) continue;
    const cover = viewport.querySelector<HTMLElement>(
      "[data-reader-loading-cover]",
    );
    if (cover && Number(getComputedStyle(cover).opacity) > 0) continue;
    const clip = viewport.getBoundingClientRect();
    for (const block of viewport.querySelectorAll<HTMLElement>(
      "[data-reader-block='true']",
    )) {
      if (
        block.dataset.chapterId !== result.locator.chapterId ||
        block.dataset.blockId !== result.locator.startBlockId
      )
        continue;
      const start = Number(block.dataset.readerStartOffset ?? 0);
      const end = Number(
        block.dataset.readerEndOffset ??
          start + (block.textContent?.length ?? 0),
      );
      const from = Math.max(start, result.locator.startOffset);
      const to = Math.min(end, result.locator.endOffset);
      if (to <= from) continue;
      const range = blockTextRange(block, from - start, to - start);
      if (!range) continue;
      const column =
        block
          .closest<HTMLElement>("[data-bilingual-column='source']")
          ?.getBoundingClientRect() ?? clip;
      if (result.matchOffset >= start && result.matchOffset < end) {
        const matchRange = blockTextRange(
          block,
          result.matchOffset - start,
          result.matchOffset - start + 1,
        );
        matchVisible ||= Array.from(matchRange?.getClientRects() ?? []).some(
          (rect) =>
            rect.right > Math.max(clip.left, column.left) &&
            rect.left < Math.min(clip.right, column.right) &&
            rect.bottom > clip.top &&
            rect.top < clip.bottom,
        );
      }
      for (const rect of range.getClientRects()) {
        const left = Math.max(rect.left, clip.left, column.left);
        const top = Math.max(rect.top, clip.top, column.top);
        const right = Math.min(rect.right, clip.right, column.right);
        const bottom = Math.min(rect.bottom, clip.bottom, column.bottom);
        if (right > left && bottom > top)
          rects.push({ left, top, width: right - left, height: bottom - top });
      }
    }
  }
  return matchVisible ? rects : [];
}
