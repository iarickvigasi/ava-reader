import type { ReaderStatusPayload } from "./api-types";

export type ReaderNavigationTarget =
  | {
      blockId?: string | null;
      edge?: "end" | "start";
    }
  | undefined;

export type RestoreIntent =
  | {
      chapterId: string;
      key: string;
      kind: "edge-start";
      sticky: true;
    }
  | {
      chapterId: string;
      key: string;
      kind: "edge-end";
      sticky: true;
    }
  | {
      blockId: string;
      chapterId: string;
      key: string;
      kind: "block";
    };

export type ReaderTraversalState = {
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
  visibleChapterId: string | null;
};

export type ReaderTraversalAction =
  | {
      chapterId: string;
      key: string;
      target?: ReaderNavigationTarget;
      type: "commit-chapter";
    }
  | {
      chapterId: string;
      type: "clear-pending";
    }
  | {
      chapterId: string;
      type: "start-pending";
    };

export function createRestoreIntent(
  chapterId: string,
  target: ReaderNavigationTarget,
  key: string,
): RestoreIntent {
  if (target?.blockId) {
    return {
      blockId: target.blockId,
      chapterId,
      key,
      kind: "block",
    };
  }

  if (target?.edge === "end") {
    return {
      chapterId,
      key,
      kind: "edge-end",
      sticky: true,
    };
  }

  return {
    chapterId,
    key,
    kind: "edge-start",
    sticky: true,
  };
}

export function createInitialTraversalState(
  initialPayload: ReaderStatusPayload,
  initialChapterParam?: string | null,
): ReaderTraversalState {
  if (initialPayload.status !== "READY") {
    return {
      pendingChapterId: null,
      restoreIntent: null,
      visibleChapterId: null,
    };
  }

  const visibleChapterId = initialPayload.activeChapterId;
  const initialTarget = resolveInitialNavigationTarget(
    initialPayload,
    initialChapterParam,
  );
  const restoreIntent = createRestoreIntent(
    visibleChapterId,
    initialTarget,
    `initial:${visibleChapterId}:${initialTarget?.blockId ? "block" : initialTarget?.edge ?? "start"}`,
  );

  return {
    pendingChapterId: null,
    restoreIntent,
    visibleChapterId,
  };
}

export function resolveInitialNavigationTarget(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  initialChapterParam?: string | null,
): ReaderNavigationTarget {
  if (initialChapterParam) {
    return { edge: "start" };
  }

  const initialLocator = payload.progress.locator;
  if (initialLocator?.chapterId === payload.activeChapterId) {
    return { blockId: initialLocator.blockId };
  }

  return { edge: "start" };
}

export function readerTraversalReducer(
  state: ReaderTraversalState,
  action: ReaderTraversalAction,
): ReaderTraversalState {
  switch (action.type) {
    case "commit-chapter":
      return {
        pendingChapterId: null,
        restoreIntent: createRestoreIntent(
          action.chapterId,
          action.target,
          action.key,
        ),
        visibleChapterId: action.chapterId,
      };
    case "clear-pending":
      return state.pendingChapterId === action.chapterId
        ? {
            ...state,
            pendingChapterId: null,
          }
        : state;
    case "start-pending":
      return {
        ...state,
        pendingChapterId: action.chapterId,
      };
    default:
      return state;
  }
}

export function resolveRequestedChapterId(input: {
  initialChapterParam?: string | null;
  pendingChapterId: string | null;
  visibleChapterId: string | null;
}) {
  return (
    input.pendingChapterId ?? input.visibleChapterId ?? input.initialChapterParam ?? null
  );
}

export function resolveVisibleChapterId(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  visibleChapterId: string | null,
) {
  if (
    visibleChapterId &&
    payload.chapters.some((chapter) => chapter.chapterId === visibleChapterId)
  ) {
    return visibleChapterId;
  }

  if (
    payload.chapters.some(
      (chapter) => chapter.chapterId === payload.activeChapterId,
    )
  ) {
    return payload.activeChapterId;
  }

  return payload.chapters[0]?.chapterId ?? null;
}

export function hasPendingRestoreIntent(
  restoreIntent: RestoreIntent | null,
  activeChapterId: string,
  consumedRestoreIntentKey: string | null,
) {
  return Boolean(
    restoreIntent &&
      restoreIntent.chapterId === activeChapterId &&
      consumedRestoreIntentKey !== restoreIntent.key,
  );
}

export function isStickyRestoreIntent(
  restoreIntent: RestoreIntent | null,
): restoreIntent is Extract<RestoreIntent, { kind: "edge-end" | "edge-start" }> {
  return restoreIntent?.kind === "edge-end" || restoreIntent?.kind === "edge-start";
}

export function resolveNextPageIndex(input: {
  activeChapterId: string;
  consumedRestoreIntentKey: string | null;
  currentPageIndex: number;
  keepRestorePinned: boolean;
  locatorBlockPageIndex: number | null;
  measuredPageCount: number;
  restoreBlockPageIndex: number | null;
  restoreIntent: RestoreIntent | null;
}) {
  const maximumPageIndex = Math.max(0, input.measuredPageCount - 1);
  let nextPageIndex = clamp(input.currentPageIndex, 0, maximumPageIndex);
  const restoreIntent = input.restoreIntent;
  const pendingRestoreIntent =
    restoreIntent &&
    hasPendingRestoreIntent(
      restoreIntent,
      input.activeChapterId,
      input.consumedRestoreIntentKey,
    );

  if (pendingRestoreIntent) {
    return resolveRestoreIntentPageIndex(
      restoreIntent,
      input.restoreBlockPageIndex,
      maximumPageIndex,
      nextPageIndex,
    );
  }

  if (
    input.keepRestorePinned &&
    input.restoreIntent?.chapterId === input.activeChapterId &&
    isStickyRestoreIntent(input.restoreIntent)
  ) {
    return input.restoreIntent.kind === "edge-end" ? maximumPageIndex : 0;
  }

  if (input.locatorBlockPageIndex !== null) {
    nextPageIndex = clamp(input.locatorBlockPageIndex, 0, maximumPageIndex);
  }

  return nextPageIndex;
}

function resolveRestoreIntentPageIndex(
  restoreIntent: RestoreIntent,
  restoreBlockPageIndex: number | null,
  maximumPageIndex: number,
  currentPageIndex: number,
) {
  switch (restoreIntent.kind) {
    case "block":
      return restoreBlockPageIndex === null
        ? currentPageIndex
        : clamp(restoreBlockPageIndex, 0, maximumPageIndex);
    case "edge-end":
      return maximumPageIndex;
    case "edge-start":
      return 0;
    default:
      return currentPageIndex;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
