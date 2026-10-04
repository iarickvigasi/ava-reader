import type { ReaderBlock } from '../../reader-types';
import { buildInlineText, normalizeInlineNodes } from './inline';
import { applyBlockStyleHints } from './block-style-hints';
import { hasInlineImages, imageBlockFromInline } from './build-image-block';
import { splitInlineImages } from './split-inline-images';
import type { BlockContext, BlockResult } from './block-context';

type TextKind = Extract<ReaderBlock, { inlines: unknown }>['kind'];
export async function buildInlineBlock(
  context: BlockContext,
  kind: TextKind,
  level?: number,
): Promise<BlockResult> {
  const options = {
    literal: context.hints.literal || kind === 'code' || kind === 'verse',
    language: context.hints.language,
    stylesheetHints: context.stylesheetHints,
    presentation: context.hints.presentation,
    ancestors: context.ancestors,
  };
  const inlines = await normalizeInlineNodes(
    context.children,
    context.resolveAsset,
    options,
  );
  const text = buildInlineText(inlines, options);
  if (!text && !hasInlineImages(inlines)) return null;
  if (!text)
    return inlines
      .filter((inline) => inline.kind === 'image')
      .map((inline) => imageBlockFromInline(inline, context));
  if (
    inlines.some(
      (inline) => inline.kind === 'image' && (inline.naturalWidth ?? 0) >= 200,
    )
  )
    return splitInlineImages(inlines, context, kind, level);
  const base = {
    anchorId: context.anchorId,
    id: context.createBlockId(),
    inlines,
    text,
  };
  return applyBlockStyleHints(
    kind === 'heading' ? { ...base, kind, level: level! } : { ...base, kind },
    context.hints,
  ) as ReaderBlock;
}
