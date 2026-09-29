import { createSentenceSegmenter } from '../../shared/create-sentence-segmenter';
import type { ReaderBlock } from '../reader-types';

const EXCERPT_WORD_LIMIT = 6;

export function createChapterExcerptLabel(input: {
  blocks: ReaderBlock[];
  language: string | null;
  spineIndex: number;
}): string {
  const prefix = `${input.spineIndex + 1}.`;
  const opening = input.blocks.find(
    (block) =>
      block.kind !== 'heading' && block.kind !== 'image' && block.text.trim(),
  );
  if (!opening) return prefix;

  const text = opening.text.replace(/\s+/gu, ' ').trim();
  const segmenter = createSentenceSegmenter(input.language);
  const sentence = [...segmenter.segment(text)][0]?.segment ?? text;
  const words = new Intl.Segmenter(segmenter.resolvedOptions().locale, {
    granularity: 'word',
  });
  const wordSegments = [...words.segment(sentence)].filter(
    (segment) => segment.isWordLike,
  );
  const lastWord = wordSegments.slice(0, EXCERPT_WORD_LIMIT).at(-1);
  if (!lastWord) return prefix;

  const excerpt = sentence.slice(0, lastWord.index + lastWord.segment.length);
  return `${prefix} ${excerpt}…`;
}
