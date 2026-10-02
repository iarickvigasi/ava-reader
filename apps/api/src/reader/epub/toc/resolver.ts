import type { ReaderChapter, ReaderTocNode } from '../../reader-types';
import type { ParsedTocNode } from './types';
import {
  buildChaptersBySpinePath,
  createAnchorBlockIdLookup,
} from './chapter-lookup';
import { resolveTocNode } from './resolve-toc-node';

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
