import type { ReaderLocator } from "./api-types";
import {
  hasPendingRestoreIntent,
  resolveNextPageIndex,
} from "./reader-navigation";
import type { RestoreIntent } from "./reader-navigation";

export type PaginationSnapshot = {
  blockPageIndexById: Record<string, number>;
  layoutKey: string;
  pageCount: number;
};

export type ResolvedPaginationSnapshot = {
  nextPageIndex: number;
  restoreState: "idle" | "pending" | "resolved";
};

export function createPaginationLayoutKey(input: {
  chapterId: string;
  fontScale: number;
  libraryItemId: string;
  viewportHeight: number;
  viewportWidth: number;
}) {
  return [
    input.libraryItemId,
    input.chapterId,
    input.viewportWidth,
    input.viewportHeight,
    input.fontScale,
  ].join(":");
}

export function measurePaginationSnapshot(input: {
  article: HTMLElement | null;
  currentPageIndex: number;
  layoutKey: string;
  pageBox: HTMLElement | null;
  pageGap: number;
}): PaginationSnapshot | null {
  const { article, currentPageIndex, layoutKey, pageBox, pageGap } = input;

  if (!article || !pageBox) {
    return null;
  }

  const pageBoxWidth = Math.floor(pageBox.clientWidth);
  const pageBoxHeight = Math.floor(pageBox.clientHeight);

  if (pageBoxWidth <= 0 || pageBoxHeight <= 0) {
    return null;
  }

  const pageSpan = pageBoxWidth + pageGap;
  if (pageSpan <= pageGap) {
    return null;
  }

  const contentWidth = Math.floor(article.scrollWidth);
  const pageCount = Math.max(1, Math.ceil((contentWidth + pageGap) / pageSpan));
  const pageBoxRect = pageBox.getBoundingClientRect();
  const blockPageIndexById: Record<string, number> = {};

  for (const blockElement of article.querySelectorAll<HTMLElement>(
    "[data-reader-block='true']",
  )) {
    const blockId = blockElement.dataset.blockId;
    if (!blockId) {
      continue;
    }

    const absoluteLeft =
      blockElement.getBoundingClientRect().left -
      pageBoxRect.left +
      currentPageIndex * pageSpan;

    blockPageIndexById[blockId] = Math.floor(Math.max(absoluteLeft, 0) / pageSpan);
  }

  return {
    blockPageIndexById,
    layoutKey,
    pageCount,
  };
}

export function resolvePageIndexFromPaginationSnapshot(input: {
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  consumedRestoreIntentKey: string | null;
  currentPageIndex: number;
  keepRestorePinned: boolean;
  locatorPageIndex: number | null;
  restorePageIndex: number | null;
  restoreIntent: RestoreIntent | null;
  snapshot: PaginationSnapshot;
}) {
  const hasPendingChapterRestoreIntent = hasPendingRestoreIntent(
    input.restoreIntent,
    input.activeChapterId,
    input.consumedRestoreIntentKey,
  );
  const nextPageIndex = resolveNextPageIndex({
    activeChapterId: input.activeChapterId,
    consumedRestoreIntentKey: input.consumedRestoreIntentKey,
    currentPageIndex: input.currentPageIndex,
    keepRestorePinned: input.keepRestorePinned,
    locatorPageIndex: input.locatorPageIndex,
    measuredPageCount: input.snapshot.pageCount,
    restorePageIndex: input.restorePageIndex,
    restoreIntent: input.restoreIntent,
  });

  return {
    nextPageIndex,
    restoreState: hasPendingChapterRestoreIntent
      ? input.restoreIntent?.kind === "block" && input.restorePageIndex === null
        ? "pending"
        : "resolved"
      : "idle",
  } satisfies ResolvedPaginationSnapshot;
}
