import type { ReaderBlock, ReaderTableCell } from '../../reader-types';
import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
} from '../xml-utils';
import { applyBlockStyleHints } from './block-style-hints';
import { buildInlineBlock } from './build-inline-block';
import { buildTableCell } from './build-table-cell';
import { occupyCell, tableRows } from './table-layout';
import type { BlockContext } from './block-context';

export async function buildTableBlock(
  context: BlockContext,
): Promise<ReaderBlock[]> {
  const cells: ReaderTableCell[] = [];
  const occupied = new Set<string>();
  for (const [row, { node, sourcePath }] of tableRows(
    context.children,
    context.sourcePath,
  ).entries()) {
    let column = 0;
    for (const [index, child] of getNodeChildren(node).entries()) {
      if (!['td', 'th'].includes(getNodeTagName(child) ?? '')) continue;
      while (occupied.has(`${row}:${column}`)) column++;
      const cell = await buildTableCell(
        child,
        node,
        { ...context, sourcePath: [...sourcePath, index] },
        row,
        column,
      );
      cells.push(cell);
      occupyCell(occupied, row, column, cell.rowSpan!, cell.columnSpan!);
      column += cell.columnSpan!;
    }
  }
  if (!cells.length) return [];
  const captions: ReaderBlock[] = [];
  const caption = context.children.find(
    (node) => getNodeTagName(node) === 'caption',
  );
  if (caption) {
    const result = await buildInlineBlock(
      {
        ...context,
        children: getNodeChildren(caption),
        anchorId: getNodeAttributes(caption)['@_id'] ?? null,
      },
      'caption',
    );
    if (result) captions.push(...(Array.isArray(result) ? result : [result]));
  }
  const headerIds = new Map(
    cells
      .filter((cell) => cell.anchorId)
      .map((cell) => [cell.anchorId!, cell.id]),
  );
  const resolved = cells.map((cell) => ({
    ...cell,
    headerIds: cell.headerIds.map((id) => {
      const target = headerIds.get(id);
      if (!target)
        throw new Error('The EPUB table has a missing header reference.');
      return target;
    }),
  }));
  const table = applyBlockStyleHints(
    {
      anchorId: context.anchorId,
      id: context.createBlockId(),
      kind: 'table' as const,
      cells: resolved,
      text: cells.map((cell) => cell.text).join('\n'),
      captionId: captions[0]?.id ?? null,
    },
    context.hints,
  );
  return [...captions, table];
}
