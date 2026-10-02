import type { ReaderChapter } from '../reader-types';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';
import { createChapterExcerptLabel } from './create-chapter-excerpt-label';

export function labelImageOnlyChapters(
  chapters: ReaderChapter[],
  language: string | null,
) {
  return chapters.map((chapter, index) => {
    if (
      !chapter.blocks.some(
        (block) => block.kind === 'image' && /^part\s/i.test(block.alt ?? ''),
      )
    )
      return chapter;
    if (chapter.label !== `${chapter.spineIndex + 1}.` || hasText(chapter))
      return chapter;
    const next = chapters.slice(index + 1).find(hasText);
    if (!next) return chapter;
    const label =
      getChapterTitleFromBlocks(next.blocks, false) ??
      createChapterExcerptLabel({
        blocks: next.blocks,
        language,
        spineIndex: chapter.spineIndex,
      });
    return { ...chapter, label, title: label };
  });
}

function hasText(chapter: ReaderChapter) {
  return chapter.blocks.some(
    (block) => block.kind !== 'image' && block.text.trim(),
  );
}
