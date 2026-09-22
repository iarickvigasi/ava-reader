import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type { ReadyReaderProps } from "../shared/types";
import { ReadyReader } from "./ready-reader";
import { BilingualReader } from "../bilingual/bilingual-reader";
import { ReadyReaderOverlays } from "./ready-reader-overlays";
import { useReaderModeRestore } from "@/features/reader/modes/use-reader-mode-restore";

export function ReaderModeRouter(props: ReadyReaderProps) {
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
    <>
      {isBilingual ? (
        <BilingualReader {...readerProps} />
      ) : (
        <ReadyReader {...readerProps} />
      )}
      <ReadyReaderOverlays {...props} />
    </>
  );
}
