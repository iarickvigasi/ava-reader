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
  );
  const measuringChapter = cache.chapter;
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
    cache,
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
