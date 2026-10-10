import type { ReaderInline } from '../../reader-types';
import type { EpubAsset } from '../archive';
import { getNodeAttributes, type OrderedNode } from '../xml-utils';
import { resolveBlockStyleHints } from './block-style-hints';
import type { InlineState } from './inline-options';

export async function resolveInlineImage(
  node: OrderedNode,
  href: string | undefined,
  resolveAsset: (path: string) => Promise<EpubAsset | null>,
  options: Pick<InlineState, 'stylesheetHints' | 'ancestors'> = {},
): Promise<ReaderInline | null> {
  const attrs = getNodeAttributes(node);
  const resolved = attrs['@_src'] && (await resolveAsset(attrs['@_src']));
  if (!resolved) return null;
  const { presentation } = resolveBlockStyleHints({
    tagName: 'img',
    attrs,
    ...options,
  });
  return {
    alt: attrs['@_alt'] ?? null,
    href,
    kind: 'image',
    naturalWidth: resolved.naturalWidth,
    naturalHeight: resolved.naturalHeight,
    src: resolved.src,
    ...(presentation ? { presentation } : {}),
  };
}
