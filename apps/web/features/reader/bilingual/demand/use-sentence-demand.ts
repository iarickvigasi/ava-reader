import { subscribeVisibility } from "./subscribe-visibility";
import { useDemandActivity } from "./use-demand-activity";
import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { ensureSentenceTranslations } from "@/features/offline/buckets/translations";
import { runSentenceDemand } from "./run-sentence-demand";

export function useSentenceDemand(
  chapter: BilingualChapter | null,
  sentenceId: string | null,
  enabled: boolean,
) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const available = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden" && navigator.onLine,
    () => false,
  );
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ chapter, sentenceId });
  useEffect(() => {
    latest.current = { chapter, sentenceId };
  }, [chapter, sentenceId]);
  const key = JSON.stringify([
    userId,
    chapter?.libraryItemId,
    chapter?.chapterId,
    chapter?.targetLang,
    chapter?.contentRevision,
    chapter?.translationVersion,
    sentenceId,
  ]);
  const translated = !!(
    chapter &&
    sentenceId &&
    chapter.translations[sentenceId]
  );
  const desired =
    !!chapter &&
    !!sentenceId &&
    enabled &&
    available &&
    !translated &&
    isLoaded &&
    !!isSignedIn;
  const { track, activeIds } = useDemandActivity(key, desired);
  useEffect(() => {
    if (!desired) return;
    const controller = new AbortController();
    void track(
      { key, ids: [latest.current.sentenceId!], signal: controller.signal },
      () =>
        runSentenceDemand(async () => {
          const current = latest.current;
          if (current.chapter && current.sentenceId) {
            await ensureSentenceTranslations(
              current.chapter,
              [current.sentenceId],
              controller.signal,
            );
          }
        }, controller.signal),
    ).catch((error: unknown) => {
      if (!controller.signal.aborted)
        setFailure({
          key,
          message:
            error instanceof Error ? error.message : "Translation failed",
        });
    });
    return () => {
      controller.abort();
    };
  }, [desired, attempt, key, track]);
  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((value) => value + 1);
  }, []);
  return {
    error: !translated && failure?.key === key ? failure.message : null,
    retry,
    available,
    activeIds,
  };
}
