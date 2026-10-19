import type { ReaderBlock } from '../../reader-types';
import {
  getNodeAttributes,
  getNodeChildren,
  type OrderedNode,
} from '../xml-utils';
import type { NormalizeBlockOptions } from './block-context';
import { normalizeBlockNode } from './block-normalizer';

export async function normalizeChildBlocks(
  children: OrderedNode[],
  options: NormalizeBlockOptions,
): Promise<ReaderBlock[]> {
  const blocks: ReaderBlock[] = [];
  let pending: string[] = [];
  for (const [index, child] of children.entries()) {
    const result = await normalizeBlockNode(child, {
      ...options,
      sourcePath: [...(options.sourcePath ?? []), index],
    });
    if (!result || (Array.isArray(result) && !result.length)) {
      pending.push(...emptyNodeAnchors(child));
      continue;
    }
    const next = Array.isArray(result) ? result : [result];
    if (pending.length)
      next[0] = {
        ...next[0],
        anchorIds: [...(next[0].anchorIds ?? []), ...pending],
      };
    pending = [];
    blocks.push(...next);
  }
  if (pending.length && blocks.length) {
    const last = blocks.at(-1)!;
    const textOffset = last.kind === 'image' ? 0 : last.text.length;
    blocks[blocks.length - 1] = {
      ...last,
      sourceAnchors: [
        ...(last.sourceAnchors ?? []),
        ...pending.map((id) => ({ id, textOffset })),
      ],
    };
  }
  return blocks;
}
function emptyNodeAnchors(node: OrderedNode): string[] {
  const attrs = getNodeAttributes(node);
  const anchor = attrs['@_id'] ?? attrs['@_name'];
  return [
    ...(anchor ? [anchor] : []),
    ...getNodeChildren(node).flatMap(emptyNodeAnchors),
  ];
}
