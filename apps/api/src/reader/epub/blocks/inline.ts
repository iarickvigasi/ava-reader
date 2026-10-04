import type { ReaderInline } from '../../reader-types';
import type { EpubAsset } from '../archive';
import type { OrderedNode } from '../xml-utils';
import { parseInlineNodes } from './inline-base';
import { normalizeInlineSequence } from './normalize-inline-sequence';
import type { InlineOptions } from './inline-options';

export { normalizeInlineSequence } from './normalize-inline-sequence';
export async function normalizeInlineNodes(
  nodes: OrderedNode[],
  resolveAsset: (path: string) => Promise<EpubAsset | null>,
  options: InlineOptions = {},
): Promise<ReaderInline[]> {
  return normalizeInlineSequence(
    await parseInlineNodes(nodes, resolveAsset, options),
    options,
  );
}
export function buildInlineText(
  inlines: ReaderInline[],
  options: InlineOptions = {},
) {
  return normalizeInlineSequence(inlines, options)
    .filter((i) => i.kind === 'text')
    .map((i) => i.text)
    .join('');
}
