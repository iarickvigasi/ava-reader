import type { CSSProperties } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { RestoreIntent } from "@/features/reader/navigation";
import {
  PAGE_GAP,
  READER_STATUS_FAILED,
  READER_STATUS_READY,
  READER_TWO_COLUMN_MIN_WIDTH,
} from "./constants";
import type { ReadyReaderPayload } from "./types";

const RESTORE_INTENT_KIND_BLOCK = "block";
const DOM_EXCEPTION_ABORT_ERROR_NAME = "AbortError";

export function getBrowserViewportHeight() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

export function resolveReaderColumnCount(pageBoxWidth: number): 1 | 2 {
  return pageBoxWidth >= READER_TWO_COLUMN_MIN_WIDTH ? 2 : 1;
}

// Column layout shared by the visible reader article and the offscreen
// preloader. Page navigation styling (e.g. translate3d) is layered on
// top of this by the caller.
export function createReaderColumnLayoutStyle({
  height,
  width,
}: {
  height: number;
  width: number;
}): CSSProperties {
  return {
    columnCount: resolveReaderColumnCount(width),
    columnGap: `${PAGE_GAP}px`,
    height: height > 0 ? `${height}px` : undefined,
  };
}

export function shouldRefreshChapterWindow(
  payload: ReadyReaderPayload,
  chapterId: string,
) {
  const chapterIndex = payload.chapters.findIndex(
    (chapter) => chapter.chapterId === chapterId,
  );

  if (chapterIndex === -1) {
    return false;
  }

  const chapter = payload.chapters[chapterIndex];

  return Boolean(
    (chapterIndex === 0 && chapter.previousChapterId) ||
      (chapterIndex === payload.chapters.length - 1 && chapter.nextChapterId),
  );
}

export function formatReaderHeaderParts(
  payload: Extract<ReaderStatusPayload, { status: typeof READER_STATUS_READY }>,
  activeChapter: ReaderChapterPayload,
) {
  return {
    title: payload.book.title,
    author: payload.book.authors[0],
    chapter: formatReaderChapterLabel(activeChapter.label),
  };
}

export function formatReaderChapterLabel(label: string) {
  return label.replace(/\bChapter\s+(\d+)\b/i, (_, chapterNumber: string) => {
    return `Chapter ${chapterNumber.padStart(2, "0")}`;
  });
}

export function createLocatorKey(locator: ReaderLocator | null) {
  if (!locator) {
    return null;
  }

  return `${locator.chapterId}:${locator.blockId}:${locator.textOffset}`;
}

export function createLocatorFromRestoreIntent(restoreIntent: RestoreIntent | null) {
  if (!restoreIntent || restoreIntent.kind !== RESTORE_INTENT_KIND_BLOCK) {
    return null;
  }

  return {
    blockId: restoreIntent.blockId,
    chapterId: restoreIntent.chapterId,
    textOffset: restoreIntent.textOffset,
  } satisfies ReaderLocator;
}

export function roundFontScale(value: number) {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === DOM_EXCEPTION_ABORT_ERROR_NAME;
}

export function isReadyReaderPayload(
  payload: ReaderStatusPayload,
): payload is ReadyReaderPayload {
  return (
    payload.status === READER_STATUS_READY &&
    Array.isArray(payload.chapters) &&
    Array.isArray(payload.toc)
  );
}

export function normalizeReaderStatusPayload(
  payload: ReaderStatusPayload,
): ReaderStatusPayload {
  if (payload.status !== READER_STATUS_READY) {
    return payload;
  }

  const candidate = payload as ReaderStatusPayload & {
    activeChapterId?: unknown;
    chapters?: unknown;
    toc?: unknown;
  };

  if (isReadyReaderPayload(candidate)) {
    return payload;
  }

  return {
    book: candidate.book,
    message: "The reader payload was incomplete. Please reload and try again.",
    progress: candidate.progress,
    status: READER_STATUS_FAILED,
  };
}

export function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, [contenteditable='true']",
    ),
  );
}

// True when the browser holds a non-empty text selection whose range sits
// inside `container`. Lets the touch swipe handler tell a genuine page-swipe
// apart from a text-selection drag: while the reader is selecting, the gesture
// must select, not turn the page (see spec 1.6-selection-bridge).
export function hasActiveSelectionWithin(container: HTMLElement | null) {
  if (!container || typeof window === "undefined") {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  if (selection.toString().trim().length === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer);
}
