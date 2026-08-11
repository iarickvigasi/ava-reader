import type { ReaderChapter } from '../../reader/reader-types';
import { splitWords } from './chapter-text';

export const HEAD_SAMPLE_WORDS = 100;
export const MID_SAMPLE_WORDS = 60;

const GAP_MARKER = '…';

/**
 * The text a chapter contributes to the prompt: ~100 words from its start plus
 * ~60 from its midpoint.
 *
 * The midpoint slice is cheap insurance. Chapter openings are frequently just
 * a heading and an epigraph, which look identical whether what follows is a
 * body chapter or an appendix; the middle is where a chapter reveals what it
 * actually is.
 */
export function sampleChapterText(
  chapter: ReaderChapter,
  options?: { headWords?: number; midWords?: number },
): string {
  const headWords = options?.headWords ?? HEAD_SAMPLE_WORDS;
  const midWords = options?.midWords ?? MID_SAMPLE_WORDS;
  const words = splitWords(
    chapter.blocks
      .map((block) => block.text)
      .filter((text) => text.trim().length > 0)
      .join(' '),
  );

  if (words.length <= headWords + midWords) {
    return words.join(' ');
  }

  const head = words.slice(0, headWords);
  const midStart = Math.floor(words.length / 2);
  const mid = words.slice(midStart, midStart + midWords);

  return `${head.join(' ')} ${GAP_MARKER} ${mid.join(' ')}`;
}
