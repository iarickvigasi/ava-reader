import type { ReaderBlock } from '../reader-types';
import { buildReaderChapters } from './build-reader-chapters';

export const text = (
  value: string,
  kind: 'heading' | 'paragraph' | 'blockquote' = 'heading',
): ReaderBlock =>
  kind === 'heading'
    ? { id: value, kind, level: 2, text: value, inlines: [] }
    : { id: value, kind, text: value, inlines: [] };
export const image = {
  id: 'image',
  kind: 'image',
  src: 'image',
  text: '',
  alt: 'part one caged',
} satisfies ReaderBlock;
export const build = (blocks: ReaderBlock[][], label?: string) =>
  buildReaderChapters({
    rawChapters: blocks.map((blocks, i) => ({ blocks, href: `${i}.xhtml` })),
    parsedToc: label
      ? [{ id: 'toc', href: '0.xhtml', label, children: [] }]
      : [],
    trustTocLabels: Boolean(label),
    allowParagraphTitles: false,
    bookTitle: 'Book',
    language: 'en',
  });
