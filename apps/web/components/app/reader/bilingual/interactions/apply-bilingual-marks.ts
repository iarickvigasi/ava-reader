import type { ReaderRangeLocator } from "@/lib/api-types/reader";
import { clipLocatorToFragment } from "@/features/reader/bilingual/position/clip-locator-to-fragment";
import { applyAiCommentMarks } from "@/components/app/reader/content/apply-ai-comment-marks";
import {
  applyHighlightMarks,
  HIGHLIGHT_MARK_CLASS,
} from "@/components/app/reader/content/apply-highlight-marks";

export function applyBilingualMarks({
  article,
  chapterId,
  blockIds,
  highlights,
  comments,
}: {
  article: HTMLElement;
  chapterId: string;
  blockIds: readonly string[];
  highlights: Parameters<typeof applyHighlightMarks>[1];
  comments: Parameters<typeof applyAiCommentMarks>[1];
}) {
  for (const block of article.querySelectorAll<HTMLElement>(
    "[data-reader-block='true']",
  )) {
    const wrapper = block.parentElement;
    const blockId = block.dataset.blockId;
    if (!wrapper || !blockId || block.dataset.readerBlockKind === "image")
      continue;
    const startOffset = Number(block.dataset.readerStartOffset ?? 0);
    const endOffset = Number(
      block.dataset.readerEndOffset ??
        startOffset + (block.textContent?.length ?? 0),
    );
    const fragment = { blockId, startOffset, endOffset };
    function clip<T extends { locator: ReaderRangeLocator | null }>(
      marks: readonly T[],
    ): T[] {
      return marks.flatMap((mark) => {
        const locator = clipLocatorToFragment(mark.locator, fragment, {
          chapterId,
          blockIds,
        });
        return locator ? [{ ...mark, locator }] : [];
      });
    }
    applyHighlightMarks(wrapper, clip(highlights));
    applyAiCommentMarks(wrapper, clip(comments));
    // Preserve measured line widths: normal-reader highlight endpoint padding
    // would otherwise reflow a paired sentence after pagination completed.
    for (const mark of wrapper.querySelectorAll<HTMLElement>(
      `mark.${HIGHLIGHT_MARK_CLASS}`,
    )) {
      mark.style.paddingLeft = "0";
      mark.style.paddingRight = "0";
    }
  }
}
