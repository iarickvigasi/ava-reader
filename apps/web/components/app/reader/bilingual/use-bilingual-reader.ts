import { useCallback } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useTranslateTargetLang } from "@/components/app/preferences/use-translate-target-lang";
import { useTranslationChapter } from "@/features/offline/buckets/translations";
import { useBilingualSize } from "@/features/reader/bilingual/measurement/use-bilingual-size";
import { usePairMeasurements } from "@/features/reader/bilingual/measurement/use-pair-measurements";
import { useBilingualPages } from "@/features/reader/bilingual/use-bilingual-pages";
import { useSentenceDemand } from "@/features/reader/bilingual/demand/use-sentence-demand";
import { useBilingualSourceLocator } from "@/features/reader/bilingual/position/use-bilingual-source-locator";
import type { ReadyReaderProps } from "../shared/types";
import { useBilingualInteractions } from "./interactions/use-bilingual-interactions";
import { useBilingualMarks } from "./interactions/use-bilingual-marks";

export function useBilingualReader(props: ReadyReaderProps) {
  const [targetLang] = useTranslateTargetLang();
  const { activePanel } = useReaderUi();
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
  const navigate = pagination.go;
  const disabled =
    props.isBootstrapping || props.isLoadingChapter || !measurement;
  const canGenerate = !disabled && !isMeasuring && activePanel === null;
  const demand = useSentenceDemand(
    measuringChapter,
    pagination.demand?.nextMissingUnitId ?? null,
    canGenerate,
  );
  const go = useCallback(
    (direction: -1 | 1) => {
      if (!isMeasuring) navigate(direction);
    },
    [isMeasuring, navigate],
  );
  const pageKey = `${chapter?.chapterId}:${pagination.pageIndex}:${layoutKey}:${chapter?.targetLang}`;
  const interactions = useBilingualInteractions({
    chapterId: props.activeChapter.chapterId,
    language: props.payload.book.language,
    pageKey,
    disabled,
    go,
  });
  useBilingualMarks({
    articleRef: interactions.sourceRef,
    chapterId: props.activeChapter.chapterId,
    blocks: props.activeChapter.blocks,
    pageKey: pagination.page,
    onAiCommentClick: interactions.onAiCommentClick,
    onHighlightClick: interactions.onHighlightClick,
  });
  useBilingualSourceLocator({
    sourceRef: interactions.sourceRef,
    chapter,
    page: pagination.page,
    layoutKey,
    onVisibleLocatorChange: props.onVisibleLocatorChange,
    rememberOffset: pagination.rememberOffset,
    disabled,
  });
  const pending =
    !chapter ||
    !pagination.page ||
    pagination.page.unitIndexes.some(
      (index) =>
        chapter.units[index].kind === "sentence" &&
        chapter.translations[chapter.units[index].id] === undefined,
    );
  const prefetchNextChapter = Boolean(
    canGenerate &&
    pagination.demand?.isComplete &&
    pagination.demand.pages.length - (pagination.page?.continuationIndex ?? 0) <
      2,
  );
  return {
    ...interactions,
    ...pagination,
    surfaceRef,
    size,
    measurement,
    measurementRef,
    chapter,
    measuringChapter,
    targetLang,
    disabled,
    pending,
    prefetchNextChapter,
    offline: !demand.available,
    error: pending ? (cache.error ?? demand.error) : null,
    retry: () => {
      cache.retry();
      demand.retry();
    },
  };
}
