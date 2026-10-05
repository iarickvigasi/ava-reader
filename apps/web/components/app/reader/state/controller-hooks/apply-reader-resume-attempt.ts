import type { ReadyReaderPayload } from "../../shared/types";
import {
  READER_RESUME_PHASE_APPLIED,
  READER_RESUME_PHASE_APPLYING,
} from "../../shared/constants";
import { resolveInitialResumeDestination } from "./use-reader-resume-bootstrap.helpers";
import type {
  ResumeAttempt,
  UseReaderResumeBootstrapInput,
} from "./use-reader-resume-bootstrap.types";

type Input = Pick<
  UseReaderResumeBootstrapInput,
  | "commitVisibleChapter"
  | "currentReadyChapterId"
  | "loadChapterWindow"
  | "loadedChaptersById"
  | "setInitialResume"
> & { payload: ReadyReaderPayload };

export async function applyReaderResumeAttempt(
  input: Input,
  attempt: ResumeAttempt,
) {
  const destination = resolveInitialResumeDestination({
    payload: input.payload,
    snapshot: attempt.snapshot,
  });
  const needsFetch =
    !input.loadedChaptersById.has(destination.targetChapterId) ||
    input.currentReadyChapterId !== destination.targetChapterId;
  try {
    if (needsFetch)
      await input.loadChapterWindow(
        destination.targetChapterId,
        destination.target,
      );
    else
      input.commitVisibleChapter(
        destination.targetChapterId,
        destination.target,
      );
  } finally {
    if (attempt.active)
      input.setInitialResume((current) =>
        attempt.active &&
        current.snapshot === attempt.snapshot &&
        current.phase === READER_RESUME_PHASE_APPLYING
          ? { ...current, phase: READER_RESUME_PHASE_APPLIED }
          : current,
      );
  }
}
