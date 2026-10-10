import { useMemo } from "react";
import { validCanonicalCatalog } from "@/features/reader/bilingual/content/validate-canonical-catalog";
import { useTranslateTargetLang } from "@/components/app/preferences/use-translate-target-lang";
import { useTranslationChapter } from "@/features/offline/buckets/translations";
import { useBilingualSize } from "@/features/reader/bilingual/measurement/use-bilingual-size";
import { usePairMeasurements } from "@/features/reader/bilingual/measurement/use-pair-measurements";
import { useBilingualPages } from "@/features/reader/bilingual/use-bilingual-pages";
import type { ReadyReaderProps } from "../shared/types";

export function useBilingualPageState(props: ReadyReaderProps) {
  const [targetLang] = useTranslateTargetLang();
  const cache = useTranslationChapter(
    props.libraryItemId,
    props.activeChapter.chapterId,
    targetLang,
    props.payload.readerPackage?.final_content_id,
  );
  const revision = props.payload.readerPackage?.final_content_id;
  const invalid = useMemo(
    () =>
      !!(
        revision &&
        cache.chapter &&
        !validCanonicalCatalog(
          cache.chapter,
          props.activeChapter.blocks,
          revision,
        )
      ),
    [revision, cache.chapter, props.activeChapter.blocks],
  );
  const measuringChapter = invalid ? null : cache.chapter;
  const { surfaceRef, size } = useBilingualSize();
  const {
    measurementRef,
    measurement,
    measuredChapter: chapter,
    layoutKey,
    isMeasuring,
  } = usePairMeasurements(measuringChapter, size, props.fontScale);
  const pagination = useBilingualPages({
    chapter,
    measurement,
    height: size.height,
    layoutKey,
    props,
  });
  return {
    cache: invalid
      ? {
          ...cache,
          chapter: null,
          status: "error" as const,
          error: "The translation source does not match this book.",
        }
      : cache,
    targetLang,
    measuringChapter,
    surfaceRef,
    size,
    chapter,
    measurementRef,
    measurement,
    layoutKey,
    isMeasuring,
    pagination,
  };
}
