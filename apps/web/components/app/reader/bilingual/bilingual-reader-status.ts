import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { BilingualPage } from "@/features/reader/bilingual/types";
import type { useTranslationChapter } from "@/features/offline/buckets/translations";
import type { useSentenceDemand } from "@/features/reader/bilingual/demand/use-sentence-demand";
import type { useAlignmentDemand } from "@/features/reader/bilingual/alignment/use-alignment-demand";
import type { usePageRegeneration } from "./use-page-regeneration";

export function bilingualReaderStatus({
  chapter,
  page,
  cache,
  demand,
  alignmentDemand,
  regeneration,
}: {
  chapter: BilingualChapter | null;
  page: BilingualPage | null;
  cache: ReturnType<typeof useTranslationChapter>;
  demand: ReturnType<typeof useSentenceDemand>;
  alignmentDemand: ReturnType<typeof useAlignmentDemand>;
  regeneration: ReturnType<typeof usePageRegeneration>;
}) {
  const pending =
    !chapter ||
    !page ||
    page.unitIndexes.some(
      (index) =>
        chapter.units[index].kind === "sentence" &&
        chapter.translations[chapter.units[index].id] === undefined,
    );
  const visibleIds =
    page?.unitIndexes.flatMap((index) => chapter?.units[index]?.id ?? []) ?? [];
  return {
    pending,
    generation: {
      translation:
        regeneration.busy === "translation" ||
        demand.activeIds.some((id) => visibleIds.includes(id)),
      pairs:
        regeneration.busy === "pairs" ||
        alignmentDemand.activeIds.some((id) => visibleIds.includes(id)),
    },
    offline: !demand.available,
    error:
      regeneration.error ??
      (pending ? (cache.error ?? demand.error) : null) ??
      alignmentDemand.error,
    alignmentFailed: regeneration.error
      ? regeneration.alignmentFailed
      : !pending && !!alignmentDemand.error,
    retry: () => {
      if (regeneration.error) {
        regeneration.retry();
        return;
      }
      cache.retry();
      demand.retry();
      alignmentDemand.retry();
    },
  };
}
