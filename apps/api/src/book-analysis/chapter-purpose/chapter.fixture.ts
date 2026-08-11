import type { ReaderBlock, ReaderChapter } from '../../reader/reader-types';

// Test-only builders. Kept out of *.spec.ts so several specs can share them
// (Jest's testRegex only picks up `.spec.ts`).

// Deterministic ids — a random suffix would make fixtures irreproducible the
// moment anything starts asserting on block identity.
let blockCounter = 0;

export function paragraph(text: string, href?: string): ReaderBlock {
  blockCounter += 1;
  return {
    id: `b${blockCounter}`,
    inlines: [{ kind: 'text', text, ...(href ? { href } : {}) }],
    kind: 'paragraph',
    text,
  };
}

export function heading(text: string): ReaderBlock {
  return {
    id: `h-${text.slice(0, 8)}`,
    inlines: [{ kind: 'text', text }],
    kind: 'heading',
    level: 1,
    text,
  };
}

export function chapter(input: {
  blocks: ReaderBlock[];
  chapterId?: string;
  label?: string;
  spineIndex?: number;
  title?: string;
}): ReaderChapter {
  const spineIndex = input.spineIndex ?? 0;

  return {
    blocks: input.blocks,
    chapterId: input.chapterId ?? `chapter-${spineIndex}`,
    href: `text/part${spineIndex}.xhtml`,
    label: input.label ?? `Chapter ${spineIndex + 1}`,
    nextChapterId: null,
    previousChapterId: null,
    spineIndex,
    title: input.title ?? input.label ?? `Chapter ${spineIndex + 1}`,
  };
}

// Numbered words so sampling tests can assert *which* part of a chapter was
// taken. Contains digits, so it is unsuitable for digit-density assertions.
export function prose(words: number): string {
  return Array.from({ length: words }, (_, index) => `word${index}`).join(' ');
}

// Digit-free filler, for tests that measure digit density.
export function plainProse(words: number): string {
  const vocabulary = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur'];

  return Array.from(
    { length: words },
    (_, index) => vocabulary[index % vocabulary.length],
  ).join(' ');
}
