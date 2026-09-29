import { createChapterExcerptLabel } from '../../reader/epub/create-chapter-excerpt-label';
import type { ReaderPackage, ReaderTocNode } from '../../reader/reader-types';

export type LabelChange = { chapterId: string; before: string; after: string };

export function relabelPackage(readerPackage: ReaderPackage) {
  const changes: LabelChange[] = [];
  const chapters = readerPackage.chapters.map((chapter) => {
    const legacy = `Chapter ${chapter.spineIndex + 1}`;
    if (chapter.label.trim().toLowerCase() !== legacy.toLowerCase())
      return chapter;
    const label = createChapterExcerptLabel({
      blocks: chapter.blocks,
      language: readerPackage.manifest.language,
      spineIndex: chapter.spineIndex,
    });
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
