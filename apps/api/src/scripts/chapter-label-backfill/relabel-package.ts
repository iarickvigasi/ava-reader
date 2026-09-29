import { createChapterExcerptLabel } from '../../reader/epub/create-chapter-excerpt-label';
import { getChapterTitleFromBlocks } from '../../reader/epub/get-chapter-title-from-blocks';
import { resolveChapterFallbackLabel } from '../../reader/epub/resolve-chapter-fallback-label';
import type { ReaderPackage, ReaderTocNode } from '../../reader/reader-types';

export type LabelChange = { chapterId: string; before: string; after: string };

export function relabelPackage(readerPackage: ReaderPackage) {
  const changes: LabelChange[] = [];
  const chapters = readerPackage.chapters.map((chapter) => {
    const legacy = `Chapter ${chapter.spineIndex + 1}`;
    const excerpt = createChapterExcerptLabel({
      blocks: chapter.blocks,
      language: readerPackage.manifest.language,
      spineIndex: chapter.spineIndex,
    });
    if (
      chapter.label.trim().toLowerCase() !== legacy.toLowerCase() &&
      chapter.label !== excerpt
    )
      return chapter;
    const label = resolveChapterFallbackLabel({
      ...chapter,
      language: readerPackage.manifest.language,
      bookTitle: readerPackage.manifest.title,
      candidateLabel: null,
      chapterTitle: getChapterTitleFromBlocks(chapter.blocks, false),
    });
    if (label === chapter.label) return chapter;
    changes.push({
      chapterId: chapter.chapterId,
      before: chapter.label,
      after: label,
    });
    return { ...chapter, label, title: label };
  });
  const labels = new Map(changes.map((change) => [change.chapterId, change]));
  return {
    changes,
    readerPackage: {
      ...readerPackage,
      chapters,
      toc: relabelToc(readerPackage.toc, labels),
    },
  };
}

export function relabelToc(
  nodes: ReaderTocNode[],
  labels: Map<string, LabelChange>,
): ReaderTocNode[] {
  return nodes.map((node) => {
    const change = node.chapterId ? labels.get(node.chapterId) : undefined;
    return {
      ...node,
      label: change && node.label === change.before ? change.after : node.label,
      children: relabelToc(node.children, labels),
    };
  });
}
