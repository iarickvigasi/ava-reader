import type { Dispatch, SetStateAction } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { ReaderTraversalAction } from "@/features/reader/navigation";
import type {
  ReaderControllerAuth,
  ReadyReaderPayload,
} from "../../../shared/types";

export type ChapterNavigationInput = ReaderControllerAuth & {
  currentReadyChapterId: string | null;
  dispatchTraversal: Dispatch<ReaderTraversalAction>;
  libraryItemId: string;
  loadedChaptersById: Map<string, ReaderChapterPayload>;
  readyPayload: ReadyReaderPayload | null;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
  setVisibleLocator: Dispatch<SetStateAction<ReaderLocator | null>>;
};
