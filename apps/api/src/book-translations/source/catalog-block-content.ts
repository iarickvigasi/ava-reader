import type { ReaderBlock, ReaderInline } from '../../reader/reader-types';

export function inlineText(inlines: ReaderInline[]): string {
  // block.text is normalized for search; DOM locators count verbatim text nodes.
  return inlines
    .map((inline) => (inline.kind === 'text' ? inline.text : ''))
    .join('');
}

export function isLiteralBlock(
  block: ReaderBlock,
): block is ReaderBlock & { kind: 'separator' | 'code' | 'verse' } {
  return ['separator', 'code', 'verse'].includes(block.kind);
}
