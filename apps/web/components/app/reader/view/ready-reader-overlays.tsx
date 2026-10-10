import { useReaderUi, type ReaderPanel } from "@/components/app/core/reader-ui-context";
import { ReaderPanelDialog, useReaderPanelActions } from "../overlays/reader-panel-dialog";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderAiChatsOverlay } from "../overlays/ai-chats/reader-ai-chats-overlay";
import { ReaderAiCommentsOverlay } from "../overlays/ai-comments/reader-ai-comments-overlay";
import { ReaderAiToolboxOverlay } from "../overlays/ai-toolbox/reader-ai-toolbox-overlay";
import { ReaderContentsOverlay } from "../overlays/contents/reader-contents-overlay";
import { ReaderHighlightsOverlay } from "../overlays/highlights/reader-highlights-overlay";
import { ReaderSearchOverlay } from "../overlays/search/reader-search-overlay";
import { ReaderDownloadOverlay } from "../overlays/download/reader-download-overlay";
import { ReaderPreferencesOverlay } from "../overlays/preferences/reader-preferences-overlay";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import type { ReaderRangeLocator } from "@/lib/api-types";

export function ReadyReaderOverlays(props: ReadyReaderProps) {
  const { activePanel, closePanel } = useReaderUi();
  if (!activePanel) return null;
  return (
    <ReaderPanelDialog key={activePanel} panel={activePanel} onClose={closePanel}>
      <ReadyReaderPanel {...props} panel={activePanel} />
    </ReaderPanelDialog>
  );
}

function ReadyReaderPanel(props: ReadyReaderProps & { panel: ReaderPanel }) {
  const { dismiss, navigate } = useReaderPanelActions();
  const { highlights } = useHighlightsContext();
  const { comments } = useAiCommentsContext();
  const jump = (locator: ReaderRangeLocator | null | undefined) => {
    if (!locator) return;
    navigate(() => props.onSelectChapter(locator.chapterId, {
      blockId: locator.startBlockId,
      textOffset: locator.startOffset,
    }));
  };
  switch (props.panel) {
    case "contents":
      return (
        <ReaderContentsOverlay
          activeChapterId={props.activeChapter.chapterId}
          activeLocator={props.displayLocator}
          onClose={dismiss}
          payload={props.payload}
          pendingChapterId={props.pendingChapterId}
          onSelectChapter={(id, target) => navigate(() => props.onSelectChapter(id, target))}
        />
      );
    case "search":
      return (
        <ReaderSearchOverlay
          payload={props.payload}
          onClose={dismiss}
          onSelect={(locator) => {
            navigate(() => props.onSelectChapter(locator.chapterId, {
              blockId: locator.blockId,
              textOffset: locator.textOffset,
            }));
          }}
        />
      );
    case "preferences":
      return (
        <ReaderPreferencesOverlay
          fontScale={props.fontScale}
          onClose={dismiss}
          onDecreaseFont={props.onDecreaseFont}
          onIncreaseFont={props.onIncreaseFont}
        />
      );
    case "download":
      return (
        <ReaderDownloadOverlay book={props.payload.book} onClose={dismiss} />
      );
    case "ai-chats":
      return <ReaderAiChatsOverlay onClose={dismiss} />;
    case "highlights":
      return (
        <ReaderHighlightsOverlay
          toc={props.payload.toc}
          onClose={dismiss}
          onSelectHighlight={(id) =>
            jump(highlights.find((row) => row.id === id)?.locator)
          }
        />
      );
    case "ai-comments":
      return (
        <ReaderAiCommentsOverlay
          toc={props.payload.toc}
          onClose={dismiss}
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
          onClose={dismiss}
        />
      );
  }
}
