import {
  resolveInitialNavigationTarget,
  type ReaderNavigationTarget,
} from "@/features/reader/navigation";
import type { ReaderResumeSnapshot } from "@/features/reader/resume";
import type { ReadyReaderPayload } from "../../shared/types";

export function resolveInitialResumeDestination(input: {
  payload: ReadyReaderPayload;
  snapshot: ReaderResumeSnapshot | null;
}): {
  target: ReaderNavigationTarget;
  targetChapterId: string;
} {
  if (input.snapshot?.locator) {
    return {
      target: {
        blockId: input.snapshot.locator.blockId,
        textOffset: input.snapshot.locator.textOffset,
      },
      targetChapterId: input.snapshot.locator.chapterId,
    };
  }

  return {
    target: resolveInitialNavigationTarget(input.payload),
    targetChapterId: input.payload.activeChapterId,
  };
}
