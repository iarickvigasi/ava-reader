import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderAiChatsOverlay } from "../overlays/ai-chats/reader-ai-chats-overlay";
import { ReaderAiCommentsOverlay } from "../overlays/ai-comments/reader-ai-comments-overlay";
import { ReaderAiToolboxOverlay } from "../overlays/ai-toolbox/reader-ai-toolbox-overlay";
import { ReaderContentsOverlay } from "../overlays/contents/reader-contents-overlay";
import { ReaderHighlightsOverlay } from "../overlays/highlights/reader-highlights-overlay";
import { ReaderPreferencesOverlay } from "../overlays/preferences/reader-preferences-overlay";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import type { ReaderRangeLocator } from "@/lib/api-types";

export function ReadyReaderOverlays(props: ReadyReaderProps) {
  const { activePanel, closePanel } = useReaderUi();
  const { highlights } = useHighlightsContext();
  const { comments } = useAiCommentsContext();
  const jump = (locator: ReaderRangeLocator | null | undefined) => {
    if (!locator) return;
    closePanel();
    props.onSelectChapter(locator.chapterId, {
      blockId: locator.startBlockId,
      textOffset: locator.startOffset,
    });
  };
  switch (activePanel) {
    case "contents":
      return (
        <ReaderContentsOverlay
          activeChapterId={props.activeChapter.chapterId}
          activeLocator={props.displayLocator}
          onClose={closePanel}
          payload={props.payload}
          pendingChapterId={props.pendingChapterId}
          onSelectChapter={(id, target) => {
            closePanel();
            props.onSelectChapter(id, target);
          }}
        />
      );
    case "preferences":
      return (
        <ReaderPreferencesOverlay
          fontScale={props.fontScale}
          onClose={closePanel}
          onDecreaseFont={props.onDecreaseFont}
          onIncreaseFont={props.onIncreaseFont}
        />
      );
    case "ai-chats":
      return <ReaderAiChatsOverlay onClose={closePanel} />;
    case "highlights":
      return (
        <ReaderHighlightsOverlay
          toc={props.payload.toc}
          onClose={closePanel}
          onSelectHighlight={(id) =>
            jump(highlights.find((row) => row.id === id)?.locator)
          }
        />
      );
    case "ai-comments":
      return (
        <ReaderAiCommentsOverlay
          toc={props.payload.toc}
          onClose={closePanel}
          onSelectAiComment={(id) =>
            jump(comments.find((row) => row.id === id)?.locator)
          }
        />
      );
    case "ai-toolbox":
      return (
        <ReaderAiToolboxOverlay
          libraryItemId={props.libraryItemId}
          book={props.payload.book}
          chapters={props.payload.chapters}
          onClose={closePanel}
        />
      );
    default:
      return null;
  }
}
