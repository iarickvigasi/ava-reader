import type { ReaderBlock } from '../../reader-types';
import type { BlockContext } from './block-context';
import { normalizeChildBlocks } from './normalize-child-blocks';
import { buildInlineBlock } from './build-inline-block';
import { hasDirectBlockChildren } from './block-tags';

export async function normalizeContainer(
  context: BlockContext,
  tagName: string,
): Promise<ReaderBlock | ReaderBlock[] | null> {
  if (!hasDirectBlockChildren(context.children))
    return buildInlineBlock(
      context,
      tagName === 'blockquote' ? 'blockquote' : 'paragraph',
    );
  const blocks = await normalizeChildBlocks(context.children, {
    ...context,
    inheritedHints: context.hints,
    inlineTextKind: tagName === 'blockquote' ? 'blockquote' : undefined,
  });
  if (context.anchorId && blocks.length)
    blocks[0] = blocks[0].anchorId
      ? {
          ...blocks[0],
          anchorIds: [...(blocks[0].anchorIds ?? []), context.anchorId],
        }
      : { ...blocks[0], anchorId: context.anchorId };
  if (tagName === 'figure') {
    const images = blocks.filter((block) => block.kind === 'image');
    const captions = blocks.filter((block) => block.kind === 'caption');
    if (images.length === 1 && captions.length === 1)
      images[0].captionId = captions[0].id;
  }
  return blocks;
}
