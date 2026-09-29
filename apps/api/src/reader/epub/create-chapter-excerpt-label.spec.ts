import { createChapterExcerptLabel } from './create-chapter-excerpt-label';
import { resolveChapterFallbackLabel } from './resolve-chapter-fallback-label';
import type { ReaderBlock } from '../reader-types';

const paragraph = (text: string): ReaderBlock => ({
  kind: 'paragraph',
  id: 'p',
  text,
  inlines: [],
});

describe('chapter excerpt labels', () => {
  it.each([
    ['It was a bright cold day in April.', '1. It was a bright cold day…'],
    ['Call me Ishmael. Another sentence follows.', '1. Call me Ishmael…'],
    ['  Call\n me\u00a0 Ishmael!  ', '1. Call me Ishmael…'],
    ['An unfinished sentence', '1. An unfinished sentence…'],
    ['', '1.'],
    ['…', '1.'],
  ])('formats %p', (text, expected) => {
    expect(
      createChapterExcerptLabel({
        blocks: [paragraph(text)],
        language: 'en',
        spineIndex: 0,
      }),
    ).toBe(expected);
  });

  it('skips headings, images and empty blocks', () => {
    const blocks: ReaderBlock[] = [
      { kind: 'heading', id: 'h', level: 1, text: 'Book', inlines: [] },
      { kind: 'image', id: 'i', src: 'cover', alt: 'Cover', text: 'Cover' },
      paragraph(' '),
      paragraph('Opening words.'),
    ];
    expect(
      createChapterExcerptLabel({ blocks, language: null, spineIndex: 4 }),
    ).toBe('5. Opening words…');
    expect(
      createChapterExcerptLabel({
        blocks: blocks.slice(0, 2),
        language: null,
        spineIndex: 4,
      }),
    ).toBe('5.');
  });

  it('handles Cyrillic and invalid language metadata', () => {
    expect(
      createChapterExcerptLabel({
        blocks: [paragraph('Коли я повертався додому, я ще не знав.')],
        language: 'invalid_locale',
        spineIndex: 2,
      }),
    ).toBe('3. Коли я повертався додому, я ще…');
  });

  it('preserves meaningful names and rejects the book title', () => {
    const input = {
      blocks: [paragraph('Opening words.')],
      language: 'en',
      spineIndex: 0,
      bookTitle: 'Book',
      candidateLabel: 'Contents',
      chapterTitle: 'Heading',
    };
    expect(resolveChapterFallbackLabel(input)).toBe('Contents');
    expect(
      resolveChapterFallbackLabel({ ...input, candidateLabel: 'Book' }),
    ).toBe('Heading');
    expect(
      resolveChapterFallbackLabel({
        ...input,
        candidateLabel: 'Book',
        chapterTitle: 'Book',
      }),
    ).toBe('1. Opening words…');
  });
});
