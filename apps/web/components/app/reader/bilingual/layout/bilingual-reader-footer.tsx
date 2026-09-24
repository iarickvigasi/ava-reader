import type { ReadyReaderProps } from "../../shared/types";
import type { useBilingualReader } from "../use-bilingual-reader";
import { BilingualFooter } from "./bilingual-footer";

export function BilingualReaderFooter({
  reader,
  props,
}: {
  reader: Omit<
    ReturnType<typeof useBilingualReader>,
    | "surfaceRef"
    | "gestureRef"
    | "sourceRef"
    | "translationRef"
    | "measurementRef"
    | "size"
  >;
  props: ReadyReaderProps;
}) {
  return (
    <BilingualFooter
      pageIndex={reader.pageIndex}
      completionPercent={props.payload.progress.completionPercent}
      error={reader.error}
      alignmentFailed={reader.alignmentFailed}
      offline={reader.offline}
      pending={reader.pending}
      retry={reader.retry}
      redoTranslation={reader.regeneration.redoTranslation}
      redoPairs={reader.regeneration.redoPairs}
      generation={reader.generation}
      redoDisabled={
        reader.disabled || reader.offline || !reader.regeneration.hasSentences
      }
      goToNextPage={reader.goToNextPage}
      goToPreviousPage={reader.goToPreviousPage}
      previousDisabled={
        reader.disabled ||
        (reader.pageIndex === 0 && !props.activeChapter.previousChapterId)
      }
      nextDisabled={
        reader.disabled ||
        (reader.pageIndex === reader.pages.length - 1 &&
          !props.activeChapter.nextChapterId)
      }
    />
  );
}
