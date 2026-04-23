import { normalizeHrefForLookup } from '../archive';
import type {
  ReaderBlock,
  ReaderChapter,
  ReaderTocNode,
} from '../../reader-types';
import type { ParsedTocNode } from './types';
import { extractAnchorIdFromHref, normalizeAnchorForLookup } from './utils';

export function resolveTocNodes(
  nodes: ParsedTocNode[],
  chapters: ReaderChapter[],
): ReaderTocNode[] {
  const chapterByHref = new Map(
    chapters.map((chapter) => [normalizeHrefForLookup(chapter.href), chapter]),
  );
  const anchorBlockIdByChapterId = new Map(
    chapters.map((chapter) => [
      chapter.chapterId,
      createAnchorBlockIdLookup(chapter.blocks),
    ]),
  );

  return nodes.flatMap((node) => {
    const resolved = resolveTocNode(
      node,
      chapterByHref,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });
}

function resolveTocNode(
  node: ParsedTocNode,
  chapterByHref: Map<string, ReaderChapter>,
  anchorBlockIdByChapterId: Map<string, Map<string, string>>,
): ReaderTocNode | null {
  const resolvedChildren = node.children.flatMap((child) => {
    const resolved = resolveTocNode(
      child,
      chapterByHref,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });

  const href = node.href;
  const chapter = href
    ? (chapterByHref.get(normalizeHrefForLookup(href)) ?? null)
    : null;
  const anchorId = href ? extractAnchorIdFromHref(href) : null;
  const blockId =
    chapter?.chapterId && anchorId
      ? (anchorBlockIdByChapterId
          .get(chapter.chapterId)
          ?.get(normalizeAnchorForLookup(anchorId)) ?? null)
      : null;

  if (!chapter && resolvedChildren.length === 0) {
    return null;
  }

  return {
    anchorId,
    blockId,
    chapterId: chapter?.chapterId ?? null,
    children: resolvedChildren,
    href,
    id: node.id,
    label: node.label,
    spineIndex: chapter?.spineIndex ?? null,
  };
}

function createAnchorBlockIdLookup(blocks: ReaderBlock[]) {
  const anchorBlockIdByAnchor = new Map<string, string>();

  for (const block of blocks) {
    if (!block.anchorId) {
      continue;
    }

    anchorBlockIdByAnchor.set(
      normalizeAnchorForLookup(block.anchorId),
      block.id,
    );
  }

  return anchorBlockIdByAnchor;
}
