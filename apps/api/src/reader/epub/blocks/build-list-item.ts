import type { ReaderListBlock, ReaderListItem } from '../../reader-types';
import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import { nodeStyleAncestor } from '../css/lookup-stylesheet-hints';
import { normalizeInlineNodes, buildInlineText } from './inline';
import {
  applyBlockStyleHints,
  resolveBlockStyleHints,
} from './block-style-hints';
import { hasInlineImages } from './build-image-block';
import { validateListFlow } from './validate-list-flow';
import { buildListBlock } from './build-list-block';
import type { BlockContext } from './block-context';

export async function buildListItem(
  node: OrderedNode,
  context: BlockContext,
  index: number,
): Promise<ReaderListItem | null> {
  validateListFlow(node, context);
  const attrs = getNodeAttributes(node);
  const hints = resolveBlockStyleHints({
    ...context,
    tagName: 'li',
    attrs,
    inherited: context.hints,
  });
  const children = getNodeChildren(node);
  const ancestors = [
    ...(context.ancestors ?? []),
    nodeStyleAncestor('li', attrs),
  ];
  const inlines = await normalizeInlineNodes(
    children.filter(
      (child) => !['ol', 'ul'].includes(getNodeTagName(child) ?? ''),
    ),
    context.resolveAsset,
    {
      literal: hints.literal,
      language: hints.language,
      stylesheetHints: context.stylesheetHints,
      presentation: hints.presentation,
      ancestors,
    },
  );
  const text = buildInlineText(inlines, { literal: hints.literal });
  const id = `${context.chapterId}::li${context.createBlockId()}-${index + 1}`;
  const nested: ReaderListBlock[] = [];
  for (const [childIndex, child] of children.entries()) {
    if (!['ol', 'ul'].includes(getNodeTagName(child) ?? '')) continue;
    const childAttrs = getNodeAttributes(child);
    const tagName = getNodeTagName(child)!;
    const childHints = resolveBlockStyleHints({
      ...context,
      tagName,
      attrs: childAttrs,
      inherited: hints,
      ancestors,
    });
    const list = await buildListBlock(
      {
        ...context,
        attrs: childAttrs,
        sourcePath: [...(context.sourcePath ?? []), childIndex],
        children: getNodeChildren(child),
        anchorId: childAttrs['@_id'] ?? null,
        hints: childHints,
        ancestors: [...ancestors, nodeStyleAncestor(tagName, childAttrs)],
      },
      tagName === 'ol',
    );
    if (list) nested.push(list);
  }
  return text || hasInlineImages(inlines) || nested.length
    ? applyBlockStyleHints(
        {
          id,
          anchorId: attrs['@_id'] ?? attrs['@_name'] ?? null,
          inlines,
          text,
          ...(nested.length ? { children: nested } : {}),
        },
        hints,
      )
    : null;
}
