import type { ReaderLocator, ReaderTocNode } from '../reader-types';

// The label shown as "you are here". Prefer the TOC entry anchored to this
// exact block; otherwise fall back to whichever entry owns the chapter.
export function findBestTocLabel(
  toc: ReaderTocNode[],
  locator: ReaderLocator,
): string | null {
  const exactMatch = findDeepestTocMatch(
    toc,
    (node) =>
      node.chapterId === locator.chapterId && node.blockId === locator.blockId,
  );

  if (exactMatch?.label) {
    return exactMatch.label;
  }

  return (
    findFirstTocMatch(toc, (node) => node.chapterId === locator.chapterId)
      ?.label ?? null
  );
}

// Deepest wins: a sub-section label is more specific than its parent's.
function findDeepestTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
  depth = 0,
): { depth: number; label: string } | null {
  let bestMatch: { depth: number; label: string } | null = null;

  for (const node of toc) {
    if (predicate(node) && node.label) {
      bestMatch = { depth, label: node.label };
    }

    const nestedMatch = findDeepestTocMatch(
      node.children,
      predicate,
      depth + 1,
    );
    if (nestedMatch && (!bestMatch || nestedMatch.depth >= bestMatch.depth)) {
      bestMatch = nestedMatch;
    }
  }

  return bestMatch;
}

function findFirstTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
): ReaderTocNode | null {
  for (const node of toc) {
    if (predicate(node)) {
      return node;
    }

    const nestedMatch = findFirstTocMatch(node.children, predicate);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}
