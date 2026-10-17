import { remapBlockIds } from './remap-block-ids';
import { labelImageOnlyChapters } from './label-image-only-chapters';
import type { ReaderBlock, ReaderChapter } from '../reader-types';
import { normalizeHrefForLookup } from './archive';
import {
  collectTocAnchorsBySpinePath,
  createChapterId,
  splitBlocksAtTocAnchors,
} from './chapters';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';
import { resolveChapterFallbackLabel } from './resolve-chapter-fallback-label';
import { findTocLabelForChapterCoord, type ParsedTocNode } from './toc';

export function buildReaderChapters(input: {
  rawChapters: { blocks: ReaderBlock[]; href: string }[];
  parsedToc: ParsedTocNode[];
  trustTocLabels: boolean;
  allowParagraphTitles: boolean;
  bookTitle: string;
  language: string | null;
}): ReaderChapter[] {
  const anchors = collectTocAnchorsBySpinePath(input.parsedToc);
  const chapters: ReaderChapter[] = [];
  for (const raw of input.rawChapters) {
    const tocAnchors =
      anchors.get(normalizeHrefForLookup(raw.href)) ?? new Set<string>();
    for (const segment of splitBlocksAtTocAnchors(raw.blocks, tocAnchors)) {
      const spineIndex = chapters.length;
      const chapterId = createChapterId(
        spineIndex,
        raw.href,
        segment.leadingAnchorId,
      );
      const label = resolveChapterFallbackLabel({
        blocks: segment.blocks,
        language: input.language,
        bookTitle: input.bookTitle,
        candidateLabel: input.trustTocLabels
          ? findTocLabelForChapterCoord(
              input.parsedToc,
              raw.href,
              segment.leadingAnchorId,
            )
          : null,
        chapterTitle: getChapterTitleFromBlocks(
          segment.blocks,
          input.allowParagraphTitles,
        ),
        spineIndex,
      });
      chapters.push({
        blocks: remapBlockIds(segment.blocks, chapterId),
        chapterId,
        href: segment.leadingAnchorId
          ? `${raw.href}#${segment.leadingAnchorId}`
          : raw.href,
        label,
        title: label,
        spineIndex,
        nextChapterId: null,
        previousChapterId: null,
      });
    }
  }
  return labelImageOnlyChapters(chapters, input.language).map(
    (chapter, index) => ({
      ...chapter,
      nextChapterId: chapters[index + 1]?.chapterId ?? null,
      previousChapterId: chapters[index - 1]?.chapterId ?? null,
    }),
  );
}
