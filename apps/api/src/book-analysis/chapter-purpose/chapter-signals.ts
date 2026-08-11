import type { ReaderChapter } from '../../reader/reader-types';
import { blockWords, countLinks, median } from './chapter-text';

/**
 * Structural signals measured locally — no AI, no tokens beyond the ~30 it
 * takes to render them. These carry the classification when titles are absent
 * or fabricated: reference material runs short, digit-dense entries, a
 * contents page is almost entirely links, and a 40-word chapter is never body
 * text.
 */
export type ChapterSignals = {
  blockCount: number;
  digitPercent: number;
  headingCount: number;
  imageCount: number;
  linkCount: number;
  medianBlockWords: number;
  positionPercent: number;
  wordCount: number;
};

export function buildChapterSignals(input: {
  chapter: ReaderChapter;
  chapterIndex: number;
  totalChapters: number;
}): ChapterSignals {
  const { chapter, chapterIndex, totalChapters } = input;
  const blocks = chapter.blocks;
  const perBlockWords = blocks.map((block) => blockWords(block).length);
  const wordCount = perBlockWords.reduce((sum, count) => sum + count, 0);
  const characters = blocks.reduce((sum, block) => sum + block.text.length, 0);
  const digits = blocks.reduce(
    (sum, block) => sum + countDigits(block.text),
    0,
  );

  return {
    blockCount: blocks.length,
    digitPercent: characters > 0 ? Math.round((digits / characters) * 100) : 0,
    headingCount: blocks.filter((block) => block.kind === 'heading').length,
    imageCount: blocks.filter((block) => block.kind === 'image').length,
    linkCount: countLinks(blocks),
    medianBlockWords: median(perBlockWords.filter((count) => count > 0)),
    positionPercent:
      totalChapters > 1
        ? Math.round((chapterIndex / (totalChapters - 1)) * 100)
        : 0,
    wordCount,
  };
}

function countDigits(text: string): number {
  return (text.match(/\d/gu) ?? []).length;
}
