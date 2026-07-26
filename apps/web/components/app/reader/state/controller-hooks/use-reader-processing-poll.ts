import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { fetchReaderPayload } from "../../data/reader-client";
import {
  READER_STATUS_POLL_INTERVAL_MS,
  READER_STATUS_PROCESSING,
} from "../../shared/constants";
import type { ReaderControllerAuth } from "../../shared/types";
import { normalizeReaderStatusPayload } from "../../shared/utils";

type UseReaderProcessingPollInput = ReaderControllerAuth & {
  libraryItemId: string;
  payloadStatus: ReaderStatusPayload["status"];
  requestedChapterId: string | null;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
};

/**
 * Polls the reader payload while a freshly-opened book is still processing
 * (parsing/conversion) server-side, so the screen flips to ready on its own.
 */
export function useReaderProcessingPoll({
  getToken,
  isLoaded,
  isSignedIn,
  libraryItemId,
  payloadStatus,
  requestedChapterId,
  setPayload,
}: UseReaderProcessingPollInput) {
  useEffect(() => {
    if (payloadStatus !== READER_STATUS_PROCESSING) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchReaderPayload({
        chapterId: requestedChapterId ?? undefined,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
      }).then((nextPayload) => {
        const normalizedPayload = normalizeReaderStatusPayload(nextPayload);
        setPayload(normalizedPayload);
      });
    }, READER_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payloadStatus,
    requestedChapterId,
    setPayload,
  ]);
}
