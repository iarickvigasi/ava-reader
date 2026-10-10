import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import { nodeStyleAncestor } from '../css/lookup-stylesheet-hints';
import { resolveBlockStyleHints } from './block-style-hints';
import {
  isBlockContainerTag,
  isInlineContainerTag,
  buildImageBlock,
  buildSeparatorBlock,
  buildListBlock,
  buildTableBlock,
  buildInlineBlock,
} from './block-builders';
import { normalizeChildBlocks } from './normalize-child-blocks';
import { buildNoteBlock } from './build-note-block';
import { getNoteRole } from './note-role';
import { normalizeContainer } from './normalize-container';
import type {
  BlockContext,
  BlockResult,
  NormalizeBlockOptions,
} from './block-context';
export type { NormalizeBlockOptions } from './block-context';

export async function normalizeBlockNode(
  node: OrderedNode,
  options: NormalizeBlockOptions,
): Promise<BlockResult> {
  const tagName = getNodeTagName(node);
  if (!tagName || ['script', 'style', 'head'].includes(tagName)) return null;
  const attrs = getNodeAttributes(node);
  const hints = resolveBlockStyleHints({
    tagName,
    attrs,
    inherited: options.inheritedHints,
    stylesheetHints: options.stylesheetHints,
    ancestors: options.ancestors,
  });
  const context: BlockContext = {
    ...options,
    attrs,
    children: getNodeChildren(node),
    anchorId: attrs['@_id'] ?? attrs['@_name'] ?? null,
    hints,
    ancestors: [
      ...(options.ancestors ?? []),
      nodeStyleAncestor(tagName, attrs),
    ],
  };
  if (tagName === '#text')
    return buildInlineBlock(
      { ...context, children: [node] },
      options.inlineTextKind ?? 'paragraph',
    );
  if (tagName === 'img') return buildImageBlock(context);
  if (tagName === 'table') return buildTableBlock(context);
  if (tagName === 'ol' || tagName === 'ul')
    return buildListBlock(context, tagName === 'ol');
  if (tagName === 'hr') return buildSeparatorBlock(context);
  if (tagName === 'pre') return buildInlineBlock(context, 'code');
  if (tagName === 'figcaption') return buildInlineBlock(context, 'caption');
  if (tagName === 'aside')
    return getNoteRole(attrs)
      ? buildNoteBlock(context)
      : buildInlineBlock(context, 'aside');
  if (/^h[1-6]$/.test(tagName))
    return buildInlineBlock(context, 'heading', Number(tagName.slice(1)));
  if (tagName === 'p')
    return buildInlineBlock(
      context,
      /(?:^|\s)verse(?:\s|$)/.test(attrs['@_class'] ?? '')
        ? 'verse'
        : 'paragraph',
    );
  if (isBlockContainerTag(tagName)) return normalizeContainer(context, tagName);
  if (isInlineContainerTag(tagName))
    return buildInlineBlock(
      { ...context, children: [node], ancestors: options.ancestors },
      'paragraph',
    );
  return normalizeChildBlocks(context.children, {
    ...context,
    inheritedHints: hints,
  });
}
