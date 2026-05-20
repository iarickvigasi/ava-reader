import type { ReaderTocNode } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "./navigation";

export type TocChapterEntry = {
  label: string;
  spineIndex: number | null;
};

// Flatten the TOC into a chapterId → label/spineIndex map for callers that
// need to label or order arbitrary chapters (e.g. highlights from outside
// the loaded chapter window). First occurrence wins so nested section
// entries don't override the canonical chapter label.
export function collectTocChapterEntries(
  toc: ReaderTocNode[],
): Map<string, TocChapterEntry> {
  const entries = new Map<string, TocChapterEntry>();

  walkTocNodes(toc, (node) => {
    if (!node.chapterId || entries.has(node.chapterId)) {
      return;
    }
    entries.set(node.chapterId, {
      label: node.label,
      spineIndex: node.spineIndex,
    });
  });

  return entries;
}

export function countUniqueTocChapters(toc: ReaderTocNode[]) {
  const chapterIds = new Set<string>();

  walkTocNodes(toc, (node) => {
    if (node.chapterId) {
      chapterIds.add(node.chapterId);
    }
  });

  return chapterIds.size;
}

export function findActiveTocPathIds(
  toc: ReaderTocNode[],
  input: {
    activeChapterId: string;
    activeBlockId: null | string;
  },
) {
  return (
    findMatchingTocPathIds(
      toc,
      (node) =>
        Boolean(input.activeBlockId) &&
        node.chapterId === input.activeChapterId &&
        node.blockId === input.activeBlockId,
    ) ??
    findMatchingTocPathIds(
      toc,
      (node) => node.chapterId === input.activeChapterId,
    ) ??
    []
  );
}

export function resolveTocNavigationTarget(
  node: ReaderTocNode,
): ReaderNavigationTarget | null {
  if (!node.chapterId) {
    return null;
  }

  if (node.blockId) {
    return {
      blockId: node.blockId,
      textOffset: 0,
    };
  }

  return {
    edge: "start",
  };
}

function findMatchingTocPathIds(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
  path: string[] = [],
): string[] | null {
  for (const node of toc) {
    const nextPath = [...path, node.id];

    if (predicate(node)) {
      return nextPath;
    }

    const nestedMatch = findMatchingTocPathIds(node.children, predicate, nextPath);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function walkTocNodes(
  toc: ReaderTocNode[],
  callback: (node: ReaderTocNode) => void,
) {
  for (const node of toc) {
    callback(node);
    walkTocNodes(node.children, callback);
  }
}
