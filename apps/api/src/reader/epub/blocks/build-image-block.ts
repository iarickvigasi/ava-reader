import type { ReaderBlock, ReaderInline } from '../../reader-types';
import type { BlockContext } from './block-context';
import { applyBlockStyleHints } from './block-style-hints';

export const hasInlineImages = (inlines: ReaderInline[]) =>
  inlines.some((inline) => inline.kind === 'image');
export function imageBlockFromInline(
  inline: Extract<ReaderInline, { kind: 'image' }>,
  context: Pick<BlockContext, 'createBlockId' | 'anchorId' | 'hints'>,
): ReaderBlock {
  const block: Extract<ReaderBlock, { kind: 'image' }> = {
    alt: inline.alt,
    anchorId: context.anchorId,
    anchorIds: inline.anchorIds,
    href: inline.href,
    sourceOffset: inline.sourceOffset,
    target: inline.target,
    id: context.createBlockId(),
    kind: 'image',
    src: inline.src,
    text: inline.alt ?? '',
    ...(inline.naturalWidth == null ? {} : { width: inline.naturalWidth }),
    ...(inline.naturalHeight == null ? {} : { height: inline.naturalHeight }),
  };
  const own = inline.presentation;
  return applyBlockStyleHints(
    block,
    !own
      ? context.hints
      : {
          ...context.hints,
          ...(own.align
            ? { align: own.align === 'start' ? 'left' : own.align }
            : {}),
          ...(own.relative_size == null
            ? {}
            : { fontSizeScale: own.relative_size }),
          ...(own.indent_em == null ? {} : { textIndent: own.indent_em }),
          presentation: { ...context.hints.presentation, ...own },
        },
  );
}
export async function buildImageBlock(
  context: BlockContext,
): Promise<ReaderBlock | null> {
  const { attrs, resolveAsset, createBlockId, anchorId } = context;
  const src = attrs['@_src'];
  const asset = src && (await resolveAsset(src));
  if (!asset) return null;
  const block: Extract<ReaderBlock, { kind: 'image' }> = {
    alt: attrs['@_alt'] ?? null,
    anchorId,
    id: createBlockId(),
    kind: 'image',
    src: asset.src,
    text: attrs['@_alt'] ?? '',
    ...(asset.naturalWidth == null ? {} : { width: asset.naturalWidth }),
    ...(asset.naturalHeight == null ? {} : { height: asset.naturalHeight }),
  };
  return applyBlockStyleHints(block, context.hints);
}
