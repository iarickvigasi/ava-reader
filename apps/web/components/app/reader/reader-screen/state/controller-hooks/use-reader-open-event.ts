import { useEffect, useRef } from "react";
import { markReaderOpened } from "../../data/reader-client";
import type { ReaderControllerAuth } from "../../shared/types";

type UseReaderOpenEventInput = ReaderControllerAuth & {
  libraryItemId: string;
};

export function useReaderOpenEvent({
  getToken,
  isLoaded,
  isSignedIn,
  libraryItemId,
}: UseReaderOpenEventInput) {
  const openEventSentLibraryItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    if (openEventSentLibraryItemIdRef.current === libraryItemId) {
      return;
    }

    openEventSentLibraryItemIdRef.current = libraryItemId;

    void markReaderOpened({
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
    }).catch(() => {
      // Ignore transient failures; reader access and local progress should continue.
    });
  }, [getToken, isLoaded, isSignedIn, libraryItemId]);
}
