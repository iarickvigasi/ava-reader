import type { ReaderBlock, ReaderInline } from '../../reader/reader-types';

/**
 * Shared text access for the digest builders. Every `ReaderBlock` variant
 * carries a flat `text`, but only some carry `inlines` (lists nest theirs
 * inside `items`), so link counting needs a walker rather than a field read.
 */
export function blockWords(block: ReaderBlock): string[] {
  return splitWords(block.text);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/u).filter((word) => word.length > 0);
}

function chapterInlines(block: ReaderBlock): ReaderInline[] {
  if (block.kind === 'list') {
    return block.items.flatMap((item) => item.inlines);
  }

  if (block.kind === 'image') {
    return [];
  }

  return block.inlines;
}

export function countLinks(blocks: ReaderBlock[]): number {
  return blocks.reduce(
    (total, block) =>
      total +
      chapterInlines(block).filter((inline) => Boolean(inline.href)).length,
    0,
  );
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}
