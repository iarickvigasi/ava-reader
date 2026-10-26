import { useState } from "react";
import { ReaderSearchOverlay } from "../overlays/search/reader-search-overlay";
import type { BookSearchResult } from "@/features/reader/search/types";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReaderAiChatsOverlay } from "../overlays/ai-chats/reader-ai-chats-overlay";
import { ReaderAiCommentsOverlay } from "../overlays/ai-comments/reader-ai-comments-overlay";
import { ReaderAiToolboxOverlay } from "../overlays/ai-toolbox/reader-ai-toolbox-overlay";
import { ReaderContentsOverlay } from "../overlays/contents/reader-contents-overlay";
import { ReaderHighlightsOverlay } from "../overlays/highlights/reader-highlights-overlay";
import { ReaderPreferencesOverlay } from "../overlays/preferences/reader-preferences-overlay";
import { useAnnotationJump } from "./use-annotation-jump";

export function ReadyReaderOverlays(
  props: ReadyReaderProps & {
    onSelectSearchResult: (result: BookSearchResult) => void;
  },
) {
  const [query, setQuery] = useState("");
  const { activePanel, closePanel } = useReaderUi();
  const { selectHighlight, selectComment } = useAnnotationJump(
    props.onSelectChapter,
  );
  switch (activePanel) {
    case "search":
      return (
        <ReaderSearchOverlay
          reader={props}
          query={query}
          onQueryChange={setQuery}
          onClose={closePanel}
          onSelect={(result) => {
            closePanel();
            props.onSelectSearchResult(result);
          }}
        />
      );
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
          onSelectHighlight={selectHighlight}
        />
      );
    case "ai-comments":
      return (
        <ReaderAiCommentsOverlay
          toc={props.payload.toc}
          onClose={closePanel}
          onSelectAiComment={selectComment}
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
