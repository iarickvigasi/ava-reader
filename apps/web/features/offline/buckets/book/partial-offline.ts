// Pure logic for the partial-offline reading notice (see [[15-partial-offline-notice]]).
// Kept Dexie/React-free so it's unit-testable; the reader hook supplies the
// gathered inputs.

import type { OfflineState } from "./storage";

type TocNodeLike = {
  chapterId: string | null;
  children?: TocNodeLike[];
};

// Decide whether to surface the "only some chapters are saved offline" notice.
// Only offline: online, the auto-save is already completing the download, so a
// warning would be noise. Never for an explicitly-saved book (the whole book is
// cached) or when the total is unknown (empty TOC — don't guess).
export function shouldShowPartialOfflineNotice(input: {
  online: boolean;
  offlineState: OfflineState;
  cachedChapterCount: number;
  totalChapterCount: number;
}): boolean {
  if (input.online) {
    return false;
  }
  if (input.offlineState === "explicit") {
    return false;
  }
  if (input.totalChapterCount <= 0) {
    return false;
  }
  return input.cachedChapterCount < input.totalChapterCount;
}

// Count the distinct chapter ids reachable in a reader TOC tree (the book's
// total chapter count). Ignores structural nodes with no chapterId.
export function countTocChapterIds(toc: TocNodeLike[]): number {
  const seen = new Set<string>();
  const walk = (nodes: TocNodeLike[]): void => {
    for (const node of nodes) {
      if (node.chapterId) {
        seen.add(node.chapterId);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(toc);
  return seen.size;
}
