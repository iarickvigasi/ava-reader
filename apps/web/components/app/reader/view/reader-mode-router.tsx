import { useRef, useState } from "react";
import { useSearchFlash } from "@/features/reader/search/use-search-flash";
import type {
  SearchTarget,
  BookSearchResult,
} from "@/features/reader/search/types";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReadyReader } from "./ready-reader";
import { BilingualReader } from "../bilingual/bilingual-reader";
import { ReadyReaderOverlays } from "./ready-reader-overlays";
import { useReaderModeRestore } from "@/features/reader/modes/use-reader-mode-restore";

export function ReaderModeRouter(props: ReadyReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  useSearchFlash(
    rootRef,
    searchTarget,
    !props.isLoadingChapter &&
      props.activeChapter.chapterId === searchTarget?.result.locator.chapterId,
  );
  const selectSearchResult = (result: BookSearchResult) => {
    setSearchTarget({ result, requestId: Date.now() });
    props.onSelectChapter(result.locator.chapterId, {
      blockId: result.locator.startBlockId,
      textOffset: result.matchOffset,
    });
  };
  const { isBilingual } = useReaderUi();
  const restoreIntent = useReaderModeRestore({
    isBilingual,
    libraryItemId: props.libraryItemId,
    activeChapterId: props.activeChapter.chapterId,
    restoreIntent: props.restoreIntent,
    visibleLocator: props.visibleLocator,
  });
  const readerProps = { ...props, restoreIntent };
  return (
    <div ref={rootRef} className="h-full">
      {isBilingual ? (
        <BilingualReader {...readerProps} />
      ) : (
        <ReadyReader {...readerProps} />
      )}
      <ReadyReaderOverlays
        key={props.libraryItemId}
        {...props}
        onSelectSearchResult={selectSearchResult}
      />
    </div>
  );
}
