import { normalizeHrefForLookup } from '../archive';
import type {
  ReaderBlock,
  ReaderChapter,
  ReaderTocNode,
} from '../../reader-types';
import type { ParsedTocNode } from './types';
import { extractAnchorIdFromHref, normalizeAnchorForLookup } from './utils';

type ChapterAtAnchor = {
  /**
   * Normalized anchor that this chapter starts at, or `null` for the leading
   * chapter of a spine doc (no anchor / pre-anchor content).
   */
  anchor: string | null;
  chapter: ReaderChapter;
};

export function resolveTocNodes(
  nodes: ParsedTocNode[],
  chapters: ReaderChapter[],
): ReaderTocNode[] {
  const chaptersBySpinePath = buildChaptersBySpinePath(chapters);
  const anchorBlockIdByChapterId = new Map(
    chapters.map((chapter) => [
      chapter.chapterId,
      createAnchorBlockIdLookup(chapter.blocks),
    ]),
  );

  return nodes.flatMap((node) => {
    const resolved = resolveTocNode(
      node,
      chaptersBySpinePath,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });
}

function resolveTocNode(
  node: ParsedTocNode,
  chaptersBySpinePath: Map<string, ChapterAtAnchor[]>,
  anchorBlockIdByChapterId: Map<string, Map<string, string>>,
): ReaderTocNode | null {
  const resolvedChildren = node.children.flatMap((child) => {
    const resolved = resolveTocNode(
      child,
      chaptersBySpinePath,
      anchorBlockIdByChapterId,
    );
    return resolved ? [resolved] : [];
  });

  const href = node.href;
  const anchorId = href ? extractAnchorIdFromHref(href) : null;
  const chapter = href
    ? findChapterForTocHref(href, anchorId, chaptersBySpinePath)
    : null;
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

function buildChaptersBySpinePath(chapters: ReaderChapter[]) {
  const result = new Map<string, ChapterAtAnchor[]>();

  for (const chapter of chapters) {
    const pathKey = normalizeHrefForLookup(chapter.href);
    const anchorRaw = extractAnchorIdFromHref(chapter.href);
    const anchor = anchorRaw ? normalizeAnchorForLookup(anchorRaw) : null;
    const existing = result.get(pathKey) ?? [];
    existing.push({ anchor, chapter });
    result.set(pathKey, existing);
  }

  return result;
}

function findChapterForTocHref(
  href: string,
  anchorId: string | null,
  chaptersBySpinePath: Map<string, ChapterAtAnchor[]>,
): ReaderChapter | null {
  const pathKey = normalizeHrefForLookup(href);
  const entries = chaptersBySpinePath.get(pathKey);

  if (!entries || entries.length === 0) {
    return null;
  }

  const targetAnchor = anchorId ? normalizeAnchorForLookup(anchorId) : null;

  // Exact (anchor or non-anchor) match wins.
  const exactMatch = entries.find((entry) => entry.anchor === targetAnchor);
  if (exactMatch) {
    return exactMatch.chapter;
  }

  // The TOC entry references an anchor that didn't end up creating its own
  // segment (the markup had no matching block-level `id`). Fall back to the
  // leading chapter for the spine doc, or the first chapter we have for it.
  const leading = entries.find((entry) => entry.anchor === null);
  return (leading ?? entries[0]).chapter;
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
