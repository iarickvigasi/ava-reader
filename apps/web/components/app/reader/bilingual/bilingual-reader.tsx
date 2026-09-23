import { useTranslations } from "next-intl";
import { BILINGUAL_COLUMN_GAP } from "@/features/reader/bilingual/measurement/use-bilingual-size";
import { bilingualLanguageTag } from "@/features/reader/bilingual/content/language-tag";
import type { ReadyReaderProps } from "../shared/types";
import { IosSelectionOverlay } from "../selection/ios/ios-selection-overlay";
import { BilingualMeasurements } from "./measurement/bilingual-measurements";
import { BilingualPageColumn } from "./layout/bilingual-page-column";
import { BilingualNextPage } from "./measurement/bilingual-next-page";
import { BilingualFooter } from "./layout/bilingual-footer";
import { ReaderFrame } from "../view/reader-frame";
import { ReaderPageViewport } from "../view/reader-page-viewport";
import { useBilingualReader } from "./use-bilingual-reader";
import { BilingualPreparingPage } from "./layout/bilingual-preparing-page";
import { BilingualAlignmentOverlay } from "./interactions/bilingual-alignment-overlay";

export function BilingualReader(props: ReadyReaderProps) {
  const t = useTranslations("reader.bilingual");
  const {
    chapter,
    page,
    measurement,
    size,
    targetLang,
    surfaceRef,
    gestureRef,
    sourceRef,
    translationRef,
    alignmentRects,
    translatedSelection,
    handleTouchStart,
    handleTouchEnd,
    selection,
    offline,
    error,
    pending,
    retry,
    disabled,
    pageIndex,
    pages,
    goToNextPage,
    goToPreviousPage,
    measurementRef,
    prefetchNextChapter,
    measuringChapter,
  } = useBilingualReader(props);
  const nextSource = props.payload.chapters.find(
    (item) => item.chapterId === props.activeChapter.nextChapterId,
  );
  const targetCode = bilingualLanguageTag(targetLang);
  return (
    <section
      data-bilingual-reader
      className="h-full min-h-0"
      aria-label={t("label")}
    >
      <ReaderFrame {...props}>
        <ReaderPageViewport>
          <div ref={surfaceRef} className="relative h-full">
            <div
              ref={gestureRef}
              className="flex h-full"
              style={{ gap: BILINGUAL_COLUMN_GAP, touchAction: "none" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {chapter && page && measurement ? (
                <>
                  <BilingualPageColumn
                    chapter={chapter}
                    blocks={props.activeChapter.blocks}
                    page={page}
                    units={measurement.units}
                    size={size}
                    side="source"
                    columnRef={sourceRef}
                    lang={props.payload.book.language ?? undefined}
                    isIosSelection={selection.isActive}
                  />
                  <BilingualPageColumn
                    chapter={chapter}
                    blocks={props.activeChapter.blocks}
                    page={page}
                    units={measurement.units}
                    size={size}
                    side="translation"
                    columnRef={translationRef}
                    isIosSelection={translatedSelection.isActive}
                    lang={targetCode}
                  />
                </>
              ) : (
                <BilingualPreparingPage {...props} />
              )}
            </div>
          </div>
        </ReaderPageViewport>
        <BilingualFooter
          pageIndex={pageIndex}
          completionPercent={props.payload.progress.completionPercent}
          error={error}
          offline={offline}
          pending={pending}
          retry={retry}
          goToNextPage={goToNextPage}
          goToPreviousPage={goToPreviousPage}
          previousDisabled={
            disabled ||
            (pageIndex === 0 && !props.activeChapter.previousChapterId)
          }
          nextDisabled={
            disabled ||
            (pageIndex === pages.length - 1 &&
              !props.activeChapter.nextChapterId)
          }
        />
      </ReaderFrame>
      <IosSelectionOverlay rects={selection.rects} />
      <IosSelectionOverlay rects={translatedSelection.rects} />
      <BilingualAlignmentOverlay rects={alignmentRects} />
      {measuringChapter && size.width > 0 && size.height > 0 ? (
        <BilingualMeasurements
          chapter={measuringChapter}
          blocks={props.activeChapter.blocks}
          size={size}
          measurementRef={measurementRef}
        />
      ) : null}
      <BilingualNextPage
        libraryItemId={props.libraryItemId}
        source={nextSource}
        targetLang={targetLang}
        enabled={prefetchNextChapter}
        size={size}
        fontScale={props.fontScale}
      />
    </section>
  );
}
