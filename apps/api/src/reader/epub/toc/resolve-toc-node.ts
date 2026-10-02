import { enrichOpeningLabel } from '../enrich-opening-label';
import type { ReaderTocNode } from '../../reader-types';
import type { ParsedTocNode } from './types';
import { findChapterForTocHref, type ChapterAtAnchor } from './chapter-lookup';
import { extractAnchorIdFromHref, normalizeAnchorForLookup } from './utils';

export function resolveTocNode(
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
    label:
      chapter &&
      normalizeAnchorForLookup(anchorId ?? '') ===
        normalizeAnchorForLookup(extractAnchorIdFromHref(chapter.href) ?? '')
        ? enrichOpeningLabel(node.label, chapter.label)
        : node.label,
    spineIndex: chapter?.spineIndex ?? null,
  };
}
