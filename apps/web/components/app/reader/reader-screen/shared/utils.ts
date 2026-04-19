import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { RestoreIntent } from "@/lib/reader-navigation";
import { formatAuthors } from "@/lib/format-authors";
import {
  READER_STATUS_FAILED,
  READER_STATUS_READY,
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

export function formatReaderHeaderLine(
  payload: Extract<ReaderStatusPayload, { status: typeof READER_STATUS_READY }>,
  activeChapter: ReaderChapterPayload,
) {
  const chapterLabel = formatReaderChapterLabel(activeChapter.label);
  return `${payload.book.title}, ${formatAuthors(payload.book.authors)} - ${chapterLabel}`;
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
