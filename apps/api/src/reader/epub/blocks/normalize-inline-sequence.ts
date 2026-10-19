import type { ReaderInline } from '../../reader-types';
import type { InlineOptions } from './inline-options';
import { normalizeInlineTextChunk } from './normalize-inline-text-chunk';

// Images interrupt whitespace collapse: spaces on opposite sides are distinct.
export function normalizeInlineSequence(
  inlines: ReaderInline[],
  options: InlineOptions = {},
): ReaderInline[] {
  const result: ReaderInline[] = [];
  let pending: ReaderInline[] = [];
  let trimStart = true;
  for (const inline of inlines) {
    if (inline.kind === 'text') pending.push(inline);
    else {
      result.push(
        ...normalizeInlineTextChunk(pending, options, trimStart, false),
        inline,
      );
      pending = [];
      trimStart = false;
    }
  }
  return [
    ...result,
    ...normalizeInlineTextChunk(pending, options, trimStart, true),
  ];
}
