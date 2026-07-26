import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import {
  createServerResumeSnapshot,
  readLocalReaderResumeSnapshot,
  selectPreferredReaderResumeSnapshot,
} from "@/features/reader/resume";
import {
  READER_RESUME_PHASE_APPLIED,
  READER_RESUME_PHASE_APPLYING,
  READER_STATUS_READY,
} from "../../shared/constants";
import type { InitialResumeBootstrapState } from "../../shared/types";
import { resolveInitialResumeDestination } from "./use-reader-resume-bootstrap.helpers";

type UseReaderResumeBootstrapInput = {
  commitVisibleChapter: (
    nextChapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  currentReadyChapterId: string | null;
  initialPayload: ReaderStatusPayload;
  initialResume: InitialResumeBootstrapState;
  libraryItemId: string;
  loadChapterWindow: (
    nextChapterId: string,
    target: ReaderNavigationTarget,
  ) => Promise<void>;
  loadedChaptersById: Map<string, ReaderChapterPayload>;
  payload: ReaderStatusPayload;
  setInitialResume: Dispatch<SetStateAction<InitialResumeBootstrapState>>;
  setVisibleLocator: Dispatch<SetStateAction<ReaderLocator | null>>;
};

export function useReaderResumeBootstrap({
  commitVisibleChapter,
  currentReadyChapterId,
  initialPayload,
  initialResume,
  libraryItemId,
  loadChapterWindow,
  loadedChaptersById,
  payload,
  setInitialResume,
  setVisibleLocator,
}: UseReaderResumeBootstrapInput) {
  const initialResumeApplyStartedRef = useRef(false);

  useEffect(() => {
    initialResumeApplyStartedRef.current = false;
    setVisibleLocator(null);

    const selection = selectPreferredReaderResumeSnapshot({
      localSnapshot: readLocalReaderResumeSnapshot(libraryItemId),
      serverSnapshot: createServerResumeSnapshot(initialPayload.progress),
    });

    setInitialResume({
      phase: READER_RESUME_PHASE_APPLYING,
      snapshot: selection.snapshot,
    });
  }, [initialPayload.progress, libraryItemId, setInitialResume, setVisibleLocator]);

  useEffect(() => {
    if (
      initialResume.phase !== READER_RESUME_PHASE_APPLYING ||
      payload.status !== READER_STATUS_READY ||
      initialResumeApplyStartedRef.current
    ) {
      return;
    }

    initialResumeApplyStartedRef.current = true;

    let isCancelled = false;

    const applyInitialResume = async () => {
      const destination = resolveInitialResumeDestination({
        payload,
        snapshot: initialResume.snapshot,
      });
      const needsFetch =
        !loadedChaptersById.has(destination.targetChapterId) ||
        currentReadyChapterId !== destination.targetChapterId;

      try {
        if (needsFetch) {
          await loadChapterWindow(destination.targetChapterId, destination.target);
        } else {
          commitVisibleChapter(destination.targetChapterId, destination.target);
        }
      } finally {
        if (!isCancelled) {
          setInitialResume((current) =>
            current.phase === READER_RESUME_PHASE_APPLYING
              ? {
                  ...current,
                  phase: READER_RESUME_PHASE_APPLIED,
                }
              : current,
          );
        }
      }
    };

    void applyInitialResume();

    return () => {
      isCancelled = true;
    };
  }, [
    commitVisibleChapter,
    currentReadyChapterId,
    initialResume.phase,
    initialResume.snapshot,
    loadChapterWindow,
    loadedChaptersById,
    payload,
    setInitialResume,
  ]);
}
