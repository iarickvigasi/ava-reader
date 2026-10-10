import type { ReaderBlock, ReaderInline } from '../../reader-types';
import { buildInlineText, normalizeInlineSequence } from './inline';
import { applyBlockStyleHints } from './block-style-hints';
import { imageBlockFromInline, hasInlineImages } from './build-image-block';
import type { BlockContext } from './block-context';

const LARGE_INLINE_IMAGE_WIDTH_PX = 200;
export function splitInlineImages(
  inlines: ReaderInline[],
  context: BlockContext,
  kind: Extract<ReaderBlock, { inlines: unknown }>['kind'],
  level?: number,
): ReaderBlock[] {
  const result: ReaderBlock[] = [];
  let pending: ReaderInline[] = [];
  let anchorId = context.anchorId;
  const flush = () => {
    const options = {
      literal: context.hints.literal || kind === 'code' || kind === 'verse',
    };
    pending = normalizeInlineSequence(pending, options);
    const text = buildInlineText(pending, options);
    if (text || hasInlineImages(pending)) {
      const base = {
        id: context.createBlockId(),
        anchorId,
        inlines: pending,
        text,
      };
      result.push(
        applyBlockStyleHints(
          kind === 'heading'
            ? { ...base, kind, level: level! }
            : { ...base, kind },
          context.hints,
        ) as ReaderBlock,
      );
      anchorId = null;
    }
    pending = [];
  };
  for (const inline of inlines) {
    if (
      inline.kind === 'image' &&
      (inline.naturalWidth ?? 0) >= LARGE_INLINE_IMAGE_WIDTH_PX
    ) {
      flush();
      result.push(imageBlockFromInline(inline, { ...context, anchorId }));
      anchorId = null;
    } else pending.push(inline);
  }
  flush();
  return result;
}
