import { renderToStaticMarkup } from "react-dom/server";
import type { RestoreIntent } from "@/features/reader/navigation";
import { ReaderArticle } from "../../content/reader-article";
import { useReaderPagination } from "../use-reader-pagination";
import { activeChapter, previousChapter } from "./cold-restore-test-fixture";

export function renderColdRestore(restoreIntent: RestoreIntent | null) {
  function Probe() {
    const result = useReaderPagination({
      activeChapter,
      previousChapter,
      nextChapter: null,
      fontScale: 1,
      isBootstrapping: false,
      isLoadingChapter: false,
      isPanelOpen: false,
      libraryItemId: "fixture",
      onSelectChapter() {},
      onVisibleLocatorChange() {},
      restoreIntent,
      visibleLocator: { chapterId: "ch8", blockId: "note-1", textOffset: 0 },
    });
    return (
      <ReaderArticle
        chapterId="ch8"
        blocks={activeChapter.blocks}
        pageHeight={419}
        prefixBlocks={result.prefixBlocks}
        prefixChapterId="ch7"
        style={result.articleStyle}
      />
    );
  }
  const html = renderToStaticMarkup(<Probe />);
  return { html, hasPrefix: html.includes('data-chapter-id="ch7"') };
}
