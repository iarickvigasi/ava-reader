import { useCallback, useMemo, useState } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReadyReaderProps } from "@/components/app/reader/shared/types";
import { paginatePairs } from "./pagination/paginate-pairs";
import {
  fillUntranslatedMeasurements,
  resolveBilingualAnchor,
} from "./position/resolve-position";
import {
  positionForBilingualPage,
  resolveBilingualPageIndex,
  type BilingualPosition,
} from "./position/page-position";
import type { measurePairs } from "./measurement/measure-pairs";

export function useBilingualPages(input: {
  chapter: BilingualChapter | null;
  measurement: ReturnType<typeof measurePairs> | null;
  height: number;
  layoutKey: string;
  props: ReadyReaderProps;
}) {
  const { chapter, measurement, height, layoutKey, props } = input;
  const restoreKey = props.restoreIntent?.key ?? null;
  const key = JSON.stringify([
    props.libraryItemId,
    chapter?.contentRevision,
    props.activeChapter.chapterId,
    restoreKey,
    chapter?.targetLang,
    chapter?.translationVersion,
  ]);
  const initial = (preferLocator: boolean): BilingualPosition => ({
    key,
    restoreKey,
    continuation: 0,
    layoutKey: "",
    ...resolveBilingualAnchor({
      units: chapter?.units ?? [],
      chapterId: props.activeChapter.chapterId,
      locator: props.visibleLocator,
      restore: props.restoreIntent,
      preferLocator,
    }),
  });
  const [position, setPosition] = useState(() => initial(true));
  const current =
    position.key === key
      ? position
      : initial(position.restoreKey === restoreKey && position.edge === null);
  if (position.key !== key) setPosition(current);
  const pages = useMemo(
    () =>
      measurement && height > 0
        ? paginatePairs({
            units: fillUntranslatedMeasurements(measurement.units),
            paneHeight: height,
            measureRange: (start, end) =>
              measurement.measureRange(start, end, true),
          }).pages
        : [],
    [measurement, height],
  );
  const pageIndex = resolveBilingualPageIndex({
    pages,
    units: chapter?.units ?? [],
    position: current,
    layoutKey,
    resolveContinuation: measurement?.resolveContinuation,
  });
  const page = pages[pageIndex] ?? null;
  const go = useCallback(
    (direction: -1 | 1) => {
      const next = pages[pageIndex + direction];
      if (!next) {
        const id =
          direction > 0
            ? props.activeChapter.nextChapterId
            : props.activeChapter.previousChapterId;
        if (id)
          props.onSelectChapter(id, { edge: direction > 0 ? "start" : "end" });
        return;
      }
      setPosition((previous) =>
        previous.key !== key
          ? previous
          : positionForBilingualPage({
              previous,
              page: next,
              units: chapter?.units ?? [],
              measured: measurement?.units ?? [],
              layoutKey,
            }),
      );
    },
    [pages, pageIndex, props, chapter, measurement, key, layoutKey],
  );
  const rememberOffset = useCallback(
    (offset: number) => {
      if (!page) return;
      setPosition((previous) =>
        previous.key !== key
          ? previous
          : positionForBilingualPage({
              previous,
              page,
              units: chapter?.units ?? [],
              measured: measurement?.units ?? [],
              layoutKey,
              offset,
              keepEdge: true,
            }),
      );
    },
    [key, page, chapter, measurement, layoutKey],
  );
  const demand = useMemo(
    () =>
      measurement && page && height > 0
        ? paginatePairs({
            units: measurement.units,
            paneHeight: height,
            startUnitIndex: page.unitIndexes[0],
            measureRange: measurement.measureRange,
            maxPages: (page.continuationIndex ?? 0) + 2,
          })
        : null,
    [measurement, page, height],
  );
  return { pages, page, pageIndex, go, demand, rememberOffset };
}
