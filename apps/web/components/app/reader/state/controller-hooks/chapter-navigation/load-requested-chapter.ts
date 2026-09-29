import { fetchReaderPayload } from "../../../data/reader-client";
import {
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
} from "../../../shared/utils";
import type { ReaderControllerAuth } from "../../../shared/types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { resolveJumpTarget } from "@/features/reader/jump-target";

export async function loadRequestedChapter(
  input: ReaderControllerAuth & {
    libraryItemId: string;
    chapterId: string;
    signal: AbortSignal;
  },
  target: ReaderNavigationTarget,
) {
  const payload = normalizeReaderStatusPayload(await fetchReaderPayload(input));
  if (!isReadyReaderPayload(payload))
    throw new Error("The requested chapter is unavailable.");
  const chapter = payload.chapters.find(
    (item) => item.chapterId === input.chapterId,
  );
  if (!chapter || !resolveJumpTarget(chapter, target))
    throw new Error("The requested passage is unavailable.");
  return payload;
}
