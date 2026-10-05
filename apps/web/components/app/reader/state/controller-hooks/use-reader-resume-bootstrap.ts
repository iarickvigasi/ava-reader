import { useEffect, useRef } from "react";
import {
  createServerResumeSnapshot,
  readLocalReaderResumeSnapshot,
  selectPreferredReaderResumeSnapshot,
} from "@/features/reader/resume";
import {
  READER_RESUME_PHASE_APPLYING,
  READER_STATUS_READY,
} from "../../shared/constants";
import { applyReaderResumeAttempt } from "./apply-reader-resume-attempt";
import type {
  ResumeAttempt,
  UseReaderResumeBootstrapInput,
} from "./use-reader-resume-bootstrap.types";

export function useReaderResumeBootstrap({
  accountId,
  cancelChapterLoad,
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
  const attemptRef = useRef<ResumeAttempt | null>(null);

  useEffect(() => {
    const selection = selectPreferredReaderResumeSnapshot({
      localSnapshot: readLocalReaderResumeSnapshot(libraryItemId),
      serverSnapshot: createServerResumeSnapshot(initialPayload.progress),
    });
    const attempt = {
      active: true,
      started: false,
      snapshot: selection.snapshot,
    };
    attemptRef.current = attempt;
    setVisibleLocator(null);
    setInitialResume({
      phase: READER_RESUME_PHASE_APPLYING,
      snapshot: attempt.snapshot,
    });
    return () => {
      attempt.active = false;
      cancelChapterLoad();
    };
  }, [
    accountId,
    cancelChapterLoad,
    initialPayload.progress,
    libraryItemId,
    setInitialResume,
    setVisibleLocator,
  ]);

  useEffect(() => {
    const attempt = attemptRef.current;
    if (
      !attempt?.active ||
      attempt.started ||
      initialResume.phase !== READER_RESUME_PHASE_APPLYING ||
      initialResume.snapshot !== attempt.snapshot ||
      payload.status !== READER_STATUS_READY
    )
      return;
    attempt.started = true;
    void applyReaderResumeAttempt(
      {
        commitVisibleChapter,
        currentReadyChapterId,
        loadChapterWindow,
        loadedChaptersById,
        payload,
        setInitialResume,
      },
      attempt,
    );
    // Payload/auth callback changes do not cancel this selected book/account attempt.
  }, [
    accountId,
    cancelChapterLoad,
    initialPayload.progress,
    libraryItemId,
    setVisibleLocator,
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
