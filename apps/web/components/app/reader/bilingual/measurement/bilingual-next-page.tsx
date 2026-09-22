import { useTranslationChapter } from "@/features/offline/buckets/translations";
import { usePairMeasurements } from "@/features/reader/bilingual/measurement/use-pair-measurements";
import { useSentenceDemand } from "@/features/reader/bilingual/demand/use-sentence-demand";
import { paginatePairs } from "@/features/reader/bilingual/pagination/paginate-pairs";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { BilingualMeasurements } from "./bilingual-measurements";

export function BilingualNextPage({
  libraryItemId,
  source,
  targetLang,
  enabled,
  size,
  fontScale,
}: {
  libraryItemId: string;
  source: ReaderChapterPayload | undefined;
  targetLang: string;
  enabled: boolean;
  size: { width: number; height: number };
  fontScale: number;
}) {
  const { chapter } = useTranslationChapter(
    libraryItemId,
    enabled ? (source?.chapterId ?? null) : null,
    targetLang,
  );
  const { measurementRef, measurement, isMeasuring } = usePairMeasurements(
    chapter,
    size,
    fontScale,
  );
  const demand =
    enabled && !isMeasuring && measurement && size.height > 0
      ? paginatePairs({
          units: measurement.units,
          paneHeight: size.height,
          maxPages: 1,
          measureRange: measurement.measureRange,
        })
      : null;
  useSentenceDemand(
    chapter,
    demand?.nextMissingUnitId ?? null,
    enabled && !isMeasuring,
  );
  return chapter && source && size.width > 0 ? (
    <BilingualMeasurements
      chapter={chapter}
      blocks={source.blocks}
      size={size}
      measurementRef={measurementRef}
    />
  ) : null;
}
