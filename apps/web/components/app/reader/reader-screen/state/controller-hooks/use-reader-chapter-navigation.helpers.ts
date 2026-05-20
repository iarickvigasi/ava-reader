import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { READER_NAVIGATION_EDGE_START } from "../../shared/constants";

const RESTORE_INTENT_KEY_SEPARATOR = ":";

function resolveRestoreIntentTargetSegment(target: ReaderNavigationTarget) {
  return target?.blockId ?? target?.edge ?? READER_NAVIGATION_EDGE_START;
}

export function createRestoreIntentKey(input: {
  chapterId: string;
  sequence: number;
  target: ReaderNavigationTarget;
}) {
  return [
    input.chapterId,
    resolveRestoreIntentTargetSegment(input.target),
    input.sequence,
  ].join(RESTORE_INTENT_KEY_SEPARATOR);
}

export function shouldApplyBackgroundResponse(input: {
  activeReadyChapterId: string | null;
  currentRequestId: number;
  requestId: number;
  requestWasAborted: boolean;
  targetChapterId: string;
}) {
  return (
    !input.requestWasAborted &&
    input.currentRequestId === input.requestId &&
    input.activeReadyChapterId === input.targetChapterId
  );
}

export function shouldApplyBlockingResponse(input: {
  currentRequestId: number;
  requestId: number;
  requestWasAborted: boolean;
}) {
  return !input.requestWasAborted && input.currentRequestId === input.requestId;
}

export function shouldFinalizeNavigationRequest(input: {
  activeAbortController: AbortController | null;
  currentRequestId: number;
  requestController: AbortController;
  requestId: number;
}) {
  return (
    input.currentRequestId === input.requestId &&
    input.activeAbortController === input.requestController
  );
}
