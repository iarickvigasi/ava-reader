import type { ReaderStatusPayload } from "@/lib/api-types";

export type ReaderNavigationTarget =
  | {
      blockId?: string | null;
      edge?: "end" | "start";
      textOffset?: number;
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
      textOffset: number;
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
      textOffset:
        Number.isFinite(target.textOffset) && (target.textOffset ?? 0) > 0
          ? Math.floor(target.textOffset ?? 0)
          : 0,
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
): ReaderTraversalState {
  if (initialPayload.status !== "READY") {
    return {
      pendingChapterId: null,
      restoreIntent: null,
      visibleChapterId: null,
    };
  }

  const visibleChapterId = initialPayload.activeChapterId;
  const initialTarget = resolveInitialNavigationTarget(initialPayload);
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
): ReaderNavigationTarget {
  const initialLocator = payload.progress.locator;
  if (initialLocator?.chapterId === payload.activeChapterId) {
    return {
      blockId: initialLocator.blockId,
      textOffset: initialLocator.textOffset,
    };
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
  pendingChapterId: string | null;
  visibleChapterId: string | null;
}) {
  return input.pendingChapterId ?? input.visibleChapterId ?? null;
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
