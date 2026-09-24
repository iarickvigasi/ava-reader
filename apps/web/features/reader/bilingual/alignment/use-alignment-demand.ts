import { useDemandActivity } from "../demand/use-demand-activity";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { ensureSentenceAlignments } from "@/features/offline/buckets/translations/align";
import { runSentenceDemand } from "../demand/run-sentence-demand";
import { validAlignments } from "./validate-alignment";

export function useAlignmentDemand(
  chapter: BilingualChapter | null,
  visibleIndexes: number[],
  enabled: boolean,
) {
  const [failure, setFailure] = useState<{
    identity: string;
    ids: string[];
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const identity = JSON.stringify([
    chapter?.libraryItemId,
    chapter?.chapterId,
    chapter?.contentRevision,
    chapter?.translationVersion,
    chapter?.targetLang,
  ]);
  const failedIds = failure?.identity === identity ? failure.ids : [];
  const maps = chapter ? validAlignments(chapter.alignments, chapter) : {};
  const last = visibleIndexes.at(-1) ?? -1;
  const candidates = [
    ...visibleIndexes,
    ...Array.from({ length: 8 }, (_, i) => last + i + 1),
  ];
  let chars = 0;
  const ids = chapter
    ? candidates
        .flatMap((index) => {
          const unit = chapter.units[index];
          if (
            !unit ||
            unit.kind !== "sentence" ||
            !chapter.translations[unit.id] ||
            maps[unit.id] ||
            failedIds.includes(unit.id)
          )
            return [];
          chars += unit.text.length + chapter.translations[unit.id].length;
          return chars <= 16000 ? [unit.id] : [];
        })
        .slice(0, 8)
    : [];
  const key = JSON.stringify([identity, ids]);
  const { track, activeIds } = useDemandActivity(key, enabled);
  const latest = useRef({ chapter, ids });
  useEffect(() => {
    latest.current = { chapter, ids };
  });
  useEffect(() => {
    if (!enabled || !latest.current.chapter || !latest.current.ids.length)
      return;
    const controller = new AbortController();
    const { chapter, ids } = latest.current;
    void track({ key, ids, signal: controller.signal }, () =>
      runSentenceDemand(
        () => ensureSentenceAlignments(chapter!, ids, controller.signal),
        controller.signal,
      ),
    ).catch((error: unknown) => {
      if (!controller.signal.aborted)
        setFailure((previous) => ({
          identity,
          ids: [
            ...new Set([
              ...(previous?.identity === identity ? previous.ids : []),
              ...ids,
            ]),
          ],
          message:
            error instanceof Error ? error.message : "Phrase matching failed.",
        }));
    });
    return () => controller.abort();
  }, [enabled, key, identity, attempt, track]);
  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((value) => value + 1);
  }, []);
  const hasVisibleFailure = visibleIndexes.some((index) => {
    const id = chapter?.units[index]?.id;
    return id && failedIds.includes(id) && !maps[id];
  });
  return {
    error: hasVisibleFailure ? (failure?.message ?? null) : null,
    retry,
    activeIds,
  };
}
