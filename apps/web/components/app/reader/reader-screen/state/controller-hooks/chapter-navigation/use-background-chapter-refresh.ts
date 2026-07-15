import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { fetchReaderPayload } from "../../../data/reader-client";
import type { ReaderControllerAuth, ReadyReaderPayload } from "../../../shared/types";
import {
  isAbortError,
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
} from "../../../shared/utils";
import {
  shouldApplyBackgroundResponse,
  shouldFinalizeNavigationRequest,
} from "./use-reader-chapter-navigation.helpers";

type UseBackgroundChapterRefreshInput = ReaderControllerAuth & {
  activeReadyChapterIdRef: MutableRefObject<string | null>;
  libraryItemId: string;
  mergeReadyPayload: (nextPayload: ReadyReaderPayload) => void;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
};

/**
 * Quietly refetches the surrounding chapter window while a chapter that's
 * already visible stays on screen, so forward/back navigation stays fast.
 */
export function useBackgroundChapterRefresh({
  activeReadyChapterIdRef,
  getToken,
  isLoaded,
  isSignedIn,
  libraryItemId,
  mergeReadyPayload,
  setPayload,
}: UseBackgroundChapterRefreshInput) {
  const [backgroundChapterId, setBackgroundChapterId] = useState<string | null>(
    null,
  );
  const backgroundRequestIdRef = useRef(0);
  const backgroundAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      backgroundAbortRef.current?.abort();
    };
  }, []);

  const cancelBackgroundRefresh = useCallback(() => {
    backgroundAbortRef.current?.abort();
    backgroundAbortRef.current = null;
    setBackgroundChapterId(null);
  }, []);

  const refreshChapterWindow = useCallback(
    (nextChapterId: string) => {
      const requestId = backgroundRequestIdRef.current + 1;
      backgroundRequestIdRef.current = requestId;
      backgroundAbortRef.current?.abort();

      const controller = new AbortController();
      backgroundAbortRef.current = controller;
      setBackgroundChapterId(nextChapterId);

      void fetchReaderPayload({
        chapterId: nextChapterId,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
      })
        .then((nextPayload) => {
          if (
            !shouldApplyBackgroundResponse({
              activeReadyChapterId: activeReadyChapterIdRef.current,
              currentRequestId: backgroundRequestIdRef.current,
              requestId,
              requestWasAborted: controller.signal.aborted,
              targetChapterId: nextChapterId,
            })
          ) {
            return;
          }

          const normalizedPayload = normalizeReaderStatusPayload(nextPayload);

          if (isReadyReaderPayload(normalizedPayload)) {
            mergeReadyPayload(normalizedPayload);
            return;
          }

          setPayload(normalizedPayload);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            throw error;
          }
        })
        .finally(() => {
          if (
            shouldFinalizeNavigationRequest({
              activeAbortController: backgroundAbortRef.current,
              currentRequestId: backgroundRequestIdRef.current,
              requestController: controller,
              requestId,
            })
          ) {
            backgroundAbortRef.current = null;
            setBackgroundChapterId((current) =>
              current === nextChapterId ? null : current,
            );
          }
        });
    },
    [activeReadyChapterIdRef, getToken, isLoaded, isSignedIn, libraryItemId, mergeReadyPayload, setPayload],
  );

  return { backgroundChapterId, cancelBackgroundRefresh, refreshChapterWindow };
}
