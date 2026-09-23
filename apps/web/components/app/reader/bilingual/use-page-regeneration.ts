import { useEffect, useRef, useState } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { regeneratePage } from "@/features/offline/buckets/translations/regenerate";

export function usePageRegeneration(
  chapter: BilingualChapter | null,
  indexes: number[],
) {
  const [busy, setBusy] = useState<"translation" | "pairs" | null>(null);
  const [failure, setFailure] = useState<{
    scope: string;
    kind: "translation" | "pairs";
    message: string;
  } | null>(null);
  const active = useRef<AbortController | null>(null);
  const scope = JSON.stringify([
    chapter?.libraryItemId,
    chapter?.chapterId,
    chapter?.contentRevision,
    chapter?.targetLang,
  ]);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [scope],
  );
  const ids = indexes.flatMap((index) => {
    const unit = chapter?.units[index];
    return unit?.kind === "sentence" ? [unit.id] : [];
  });
  const redo = async (kind: "translation" | "pairs") => {
    if (!chapter || !ids.length || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(kind);
    setFailure(null);
    try {
      await regeneratePage(chapter, ids, kind, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted)
        setFailure({
          scope,
          kind,
          message:
            error instanceof Error
              ? error.message
              : "Could not regenerate this page.",
        });
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(null);
      }
    }
  };
  return {
    busy,
    alignmentFailed: failure?.scope === scope && failure.kind === "pairs",
    retry: () => {
      if (failure?.scope === scope) void redo(failure.kind);
    },
    error: failure?.scope === scope ? failure.message : null,
    hasSentences: ids.length > 0,
    redoTranslation: () => {
      void redo("translation");
    },
    redoPairs: () => {
      void redo("pairs");
    },
  };
}
