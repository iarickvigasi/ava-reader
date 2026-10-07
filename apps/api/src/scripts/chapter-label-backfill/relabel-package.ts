import { findFilenameLabels } from './find-filename-labels';
import { isHrefLabel } from '../../reader/epub/toc/is-href-label';
import { enrichOpeningLabel } from '../../reader/epub/enrich-opening-label';
import { labelImageOnlyChapters } from '../../reader/epub/label-image-only-chapters';
import { createChapterExcerptLabel } from '../../reader/epub/create-chapter-excerpt-label';
import { getChapterTitleFromBlocks } from '../../reader/epub/get-chapter-title-from-blocks';
import { resolveChapterFallbackLabel } from '../../reader/epub/resolve-chapter-fallback-label';
import type { ReaderPackage, ReaderTocNode } from '../../reader/reader-types';

export type LabelChange = { chapterId: string; before: string; after: string };

export function relabelPackage(readerPackage: ReaderPackage) {
  const language = readerPackage.manifest.language;
  const candidates = readerPackage.chapters.map((chapter) => {
    const opening = getChapterTitleFromBlocks(chapter.blocks, false);
    const enriched = enrichOpeningLabel(chapter.label, opening);
    const legacy = `Chapter ${chapter.spineIndex + 1}`;
    const excerpt = createChapterExcerptLabel({ ...chapter, language });
    if (
      chapter.label.trim().toLowerCase() !== legacy.toLowerCase() &&
      chapter.label !== excerpt &&
      enriched === chapter.label &&
      !isHrefLabel(chapter.label, chapter.href)
    )
      return chapter;
    const label = resolveChapterFallbackLabel({
      ...chapter,
      language,
      bookTitle: readerPackage.manifest.title,
      candidateLabel: enriched !== chapter.label ? enriched : null,
      chapterTitle: opening,
    });
    return label === chapter.label
      ? chapter
      : { ...chapter, label, title: label };
  });
  const chapters = labelImageOnlyChapters(candidates, language);
  const filenames = findFilenameLabels(readerPackage.toc);
  const changes: LabelChange[] = chapters.flatMap((chapter, index) => {
    const before = readerPackage.chapters[index].label;
    return before === chapter.label && !filenames.has(chapter.chapterId)
      ? []
      : [
          {
            chapterId: chapter.chapterId,
            before:
              before === chapter.label
                ? filenames.get(chapter.chapterId)!
                : before,
            after: chapter.label,
          },
        ];
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
      label:
        change &&
        (node.label === change.before || isHrefLabel(node.label, node.href))
          ? change.after
          : node.label,
      children: relabelToc(node.children, labels),
    };
  });
}
