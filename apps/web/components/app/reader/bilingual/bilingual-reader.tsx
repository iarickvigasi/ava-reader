import { useTranslations } from "next-intl";
import { BilingualPanes } from "./layout/bilingual-panes";
import { bilingualLanguageTag } from "@/features/reader/bilingual/content/language-tag";
import type { ReadyReaderProps } from "../shared/types";
import { IosSelectionOverlay } from "../selection/ios/ios-selection-overlay";
import { BilingualMeasurements } from "./measurement/bilingual-measurements";
import { BilingualPageColumn } from "./layout/bilingual-page-column";
import { BilingualNextPage } from "./measurement/bilingual-next-page";
import { BilingualReaderFooter } from "./layout/bilingual-reader-footer";
import { ReaderFrame } from "../view/reader-frame";
import { ReaderPageViewport } from "../view/reader-page-viewport";
import { useBilingualReader } from "./use-bilingual-reader";
import { BilingualPreparingPage } from "./layout/bilingual-preparing-page";
import { BilingualAlignmentOverlay } from "./interactions/bilingual-alignment-overlay";

export function BilingualReader(props: ReadyReaderProps) {
  const t = useTranslations("reader.bilingual");
  const {
    surfaceRef,
    gestureRef,
    sourceRef,
    translationRef,
    measurementRef,
    size,
    ...reader
  } = useBilingualReader(props);
  const nextSource = props.payload.chapters.find(
    (item) => item.chapterId === props.activeChapter.nextChapterId,
  );
  return (
    <section
      data-bilingual-reader
      className="h-full min-h-0"
      aria-label={t("label")}
    >
      <ReaderFrame {...props}>
        <ReaderPageViewport>
          <div ref={surfaceRef} className="relative h-full">
            <BilingualPanes
              ref={gestureRef}
              onTouchStart={reader.handleTouchStart}
              onTouchEnd={reader.handleTouchEnd}
            >
              {reader.chapter && reader.page && reader.measurement ? (
                <>
                  <BilingualPageColumn
                    chapter={reader.chapter}
                    blocks={props.activeChapter.blocks}
                    page={reader.page}
                    units={reader.measurement.units}
                    size={size}
                    side="source"
                    columnRef={sourceRef}
                    lang={props.payload.book.language ?? undefined}
                    isIosSelection={reader.selection.isActive}
                  />
                  <BilingualPageColumn
                    chapter={reader.chapter}
                    blocks={props.activeChapter.blocks}
                    page={reader.page}
                    units={reader.measurement.units}
                    size={size}
                    side="translation"
                    columnRef={translationRef}
                    isIosSelection={reader.translatedSelection.isActive}
                    lang={bilingualLanguageTag(reader.targetLang)}
                  />
                </>
              ) : (
                <BilingualPreparingPage {...props} />
              )}
            </BilingualPanes>
          </div>
        </ReaderPageViewport>
        <BilingualReaderFooter reader={reader} props={props} />
      </ReaderFrame>
      <IosSelectionOverlay rects={reader.selection.rects} />
      <IosSelectionOverlay rects={reader.translatedSelection.rects} />
      <BilingualAlignmentOverlay rects={reader.alignmentRects} />
      {reader.measuringChapter && size.width > 0 && size.height > 0 ? (
        <BilingualMeasurements
          chapter={reader.measuringChapter}
          blocks={props.activeChapter.blocks}
          size={size}
          measurementRef={measurementRef}
        />
      ) : null}
      <BilingualNextPage
        libraryItemId={props.libraryItemId}
        source={nextSource}
        targetLang={reader.targetLang}
        enabled={reader.prefetchNextChapter}
        size={size}
        fontScale={props.fontScale}
      />
    </section>
  );
}
