import { useBilingualJump } from "@/features/reader/bilingual/position/use-bilingual-jump";
import { useReaderNavigationActions } from "../state/reader-navigation-context";
import { useBilingualPageState } from "./use-bilingual-page-state";
import { bilingualReaderStatus } from "./bilingual-reader-status";
import { usePageRegeneration } from "./use-page-regeneration";
import { useCallback } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useSentenceDemand } from "@/features/reader/bilingual/demand/use-sentence-demand";
import { useBilingualSourceLocator } from "@/features/reader/bilingual/position/use-bilingual-source-locator";
import type { ReadyReaderProps } from "../shared/types";
import { useBilingualInteractions } from "./interactions/use-bilingual-interactions";
import { useAlignmentDemand } from "@/features/reader/bilingual/alignment/use-alignment-demand";

export function useBilingualReader(props: ReadyReaderProps) {
  const navigation = useReaderNavigationActions();
  const { activePanel } = useReaderUi();
  const {
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
  } = useBilingualPageState(props);
  const regeneration = usePageRegeneration(
    chapter,
    pagination.page?.unitIndexes ?? [],
  );
  const navigate = pagination.go;
  const disabled =
    props.isBootstrapping ||
    props.isLoadingChapter ||
    !measurement ||
    !!regeneration.busy;
  const canGenerate = !disabled && !isMeasuring && activePanel === null;
  const demand = useSentenceDemand(
    measuringChapter,
    pagination.demand?.nextMissingUnitId ?? null,
    canGenerate,
  );
  const go = useCallback(
    (direction: -1 | 1) => {
      if (!isMeasuring && !regeneration.busy) {
        navigation?.leavePassage();
        navigate(direction);
      }
    },
    [isMeasuring, navigate, regeneration.busy, navigation],
  );
  const pageKey = `${chapter?.chapterId}:${pagination.pageIndex}:${layoutKey}:${chapter?.targetLang}`;
  const interactions = useBilingualInteractions({
    chapter,
    chapterId: props.activeChapter.chapterId,
    blocks: props.activeChapter.blocks,
    language: props.payload.book.language,
    pageKey,
    disabled,
    go,
  });
  useBilingualJump({
    sourceRef: interactions.sourceRef,
    chapter,
    intent: props.restoreIntent,
    ready: !disabled && !isMeasuring && !!pagination.page,
    pageKey,
  });
  const alignmentDemand = useAlignmentDemand(
    measuringChapter,
    pagination.page?.unitIndexes ?? [],
    !disabled && activePanel === null && demand.available && !!pagination.page,
  );
  useBilingualSourceLocator({
    sourceRef: interactions.sourceRef,
    chapter,
    page: pagination.page,
    layoutKey,
    onVisibleLocatorChange: props.onVisibleLocatorChange,
    rememberOffset: pagination.rememberOffset,
    disabled,
  });
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
    regeneration,
    prefetchNextChapter,
    ...bilingualReaderStatus({
      chapter,
      page: pagination.page,
      cache,
      demand,
      alignmentDemand,
      regeneration,
    }),
  };
}
