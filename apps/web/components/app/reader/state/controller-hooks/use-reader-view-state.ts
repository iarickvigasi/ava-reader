import { useMemo } from "react";
import type { ReaderChapterPayload, ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import {
  resolveRequestedChapterId,
  resolveVisibleChapterId,
  type ReaderTraversalState,
} from "@/features/reader/navigation";
import { READER_PERSISTENCE_MODE_REMOTE, type ReaderPersistenceMode } from "../../shared/constants";
import type { InitialResumeBootstrapState } from "../../shared/types";
import { createLocatorFromRestoreIntent, isReadyReaderPayload } from "../../shared/utils";

type UseReaderViewStateInput = {
  initialResume: InitialResumeBootstrapState;
  payload: ReaderStatusPayload;
  persistenceMode: ReaderPersistenceMode;
  traversal: ReaderTraversalState;
  visibleLocator: ReaderLocator | null;
};

/**
 * Derives the reader's view-facing values (loaded chapters, active chapter,
 * position to render) from the controller's raw state, so the orchestrator
 * doesn't have to interleave this bookkeeping with its hook calls.
 */
export function useReaderViewState({
  initialResume,
  payload,
  persistenceMode,
  traversal,
  visibleLocator,
}: UseReaderViewStateInput) {
  const readyPayload = isReadyReaderPayload(payload) ? payload : null;

  const loadedChaptersById = useMemo(
    () =>
      readyPayload
        ? new Map(
            readyPayload.chapters.map((chapter) => [chapter.chapterId, chapter]),
          )
        : new Map<string, ReaderChapterPayload>(),
    [readyPayload],
  );

  const activeChapterId = readyPayload
    ? resolveVisibleChapterId(readyPayload, traversal.visibleChapterId)
    : null;
  const activeChapter = activeChapterId
    ? loadedChaptersById.get(activeChapterId) ?? null
    : null;
  const requestedChapterId = resolveRequestedChapterId({
    pendingChapterId: traversal.pendingChapterId,
    visibleChapterId: traversal.visibleChapterId,
  });

  const displayLocator = useMemo(() => {
    if (visibleLocator) {
      return visibleLocator;
    }

    const restoreLocator = createLocatorFromRestoreIntent(traversal.restoreIntent);
    return (
      restoreLocator ?? initialResume.snapshot?.locator ?? payload.progress.locator
    );
  }, [
    initialResume.snapshot,
    payload.progress.locator,
    traversal.restoreIntent,
    visibleLocator,
  ]);

  return {
    activeChapter,
    activeChapterId,
    displayLocator,
    loadedChaptersById,
    readyPayload,
    remotePersistenceEnabled: persistenceMode === READER_PERSISTENCE_MODE_REMOTE,
    requestedChapterId,
  };
}
