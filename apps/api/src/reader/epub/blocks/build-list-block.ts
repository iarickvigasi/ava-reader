import type { ReaderListBlock, ReaderListItem } from '../../reader-types';
import { getNodeTagName } from '../xml-utils';
import { applyBlockStyleHints } from './block-style-hints';
import { buildListItem } from './build-list-item';
import type { BlockContext } from './block-context';

const MARKERS: Record<string, ReaderListBlock['markerStyle']> = {
  '1': 'decimal',
  a: 'lower-alpha',
  A: 'upper-alpha',
  i: 'lower-roman',
  I: 'upper-roman',
};
export async function buildListBlock(
  context: BlockContext,
  ordered: boolean,
): Promise<ReaderListBlock | null> {
  const items: ReaderListItem[] = [];
  for (const [index, node] of context.children.entries()) {
    if (getNodeTagName(node) !== 'li') continue;
    const item = await buildListItem(
      node,
      { ...context, sourcePath: [...(context.sourcePath ?? []), index] },
      items.length,
    );
    if (item) items.push(item);
  }
  if (!items.length) return null;
  const startText = context.attrs['@_start'];
  const start =
    startText && /^[+-]?\d+$/.test(startText) ? Number(startText) : undefined;
  const markerStyle = MARKERS[context.attrs['@_type']];
  return applyBlockStyleHints(
    {
      anchorId: context.anchorId,
      id: context.createBlockId(),
      kind: 'list',
      ordered,
      items,
      text: items
        .map((item) =>
          [item.text, ...(item.children ?? []).map((child) => child.text)].join(
            '\n',
          ),
        )
        .join('\n'),
      ...(Number.isSafeInteger(start) ? { start } : {}),
      ...(markerStyle ? { markerStyle } : {}),
    },
    context.hints,
  );
}
