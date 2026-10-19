import type { Dispatch, SetStateAction } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { ReaderResumeSnapshot } from "@/features/reader/resume";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { InitialResumeBootstrapState } from "../../shared/types";

export type UseReaderResumeBootstrapInput = {
  accountId: string | null | undefined;
  cancelChapterLoad: () => void;
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

export type ResumeAttempt = {
  active: boolean;
  started: boolean;
  snapshot: ReaderResumeSnapshot | null;
};
