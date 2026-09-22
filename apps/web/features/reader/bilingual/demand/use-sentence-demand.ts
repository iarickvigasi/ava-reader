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

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    document.removeEventListener("visibilitychange", notify);
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

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
  useEffect(() => {
    if (!desired) return;
    const controller = new AbortController();
    void runSentenceDemand(async () => {
      const current = latest.current;
      if (current.chapter && current.sentenceId) {
        await ensureSentenceTranslations(
          current.chapter,
          [current.sentenceId],
          controller.signal,
        );
      }
    }, controller.signal).catch((error: unknown) => {
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
  }, [desired, attempt, key]);
  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((value) => value + 1);
  }, []);
  return {
    error: !translated && failure?.key === key ? failure.message : null,
    retry,
    available,
  };
}
