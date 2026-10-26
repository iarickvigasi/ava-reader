import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import type { ReaderRangeLocator } from "@/lib/api-types";
import type { ReadyReaderProps } from "../shared/types";

export function useAnnotationJump(
  onSelectChapter: ReadyReaderProps["onSelectChapter"],
) {
  const { closePanel } = useReaderUi();
  const { highlights } = useHighlightsContext();
  const { comments } = useAiCommentsContext();
  function jump(locator: ReaderRangeLocator | null | undefined) {
    if (!locator) return;
    closePanel();
    onSelectChapter(locator.chapterId, {
      blockId: locator.startBlockId,
      textOffset: locator.startOffset,
    });
  }
  return {
    selectHighlight: (id: string) =>
      jump(highlights.find((row) => row.id === id)?.locator),
    selectComment: (id: string) =>
      jump(comments.find((row) => row.id === id)?.locator),
  };
}
