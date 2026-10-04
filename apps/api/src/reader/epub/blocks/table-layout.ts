import {
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';

export function tableRows(
  nodes: OrderedNode[],
  parentPath: number[] = [],
): { node: OrderedNode; sourcePath: number[] }[] {
  return nodes.flatMap((node, index) => {
    const sourcePath = [...parentPath, index];
    if (getNodeTagName(node) === 'tr') return [{ node, sourcePath }];
    return ['thead', 'tbody', 'tfoot'].includes(getNodeTagName(node) ?? '')
      ? tableRows(getNodeChildren(node), sourcePath)
      : [];
  });
}
export function positiveSpan(value?: string): number {
  const span = value && /^\d+$/.test(value) ? Number(value) : 1;
  if (!Number.isSafeInteger(span) || span < 1 || span > 1000)
    throw new Error('The EPUB table has an unsupported cell span.');
  return span;
}
export function occupyCell(
  occupied: Set<string>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
): void {
  for (let r = row; r < row + rowSpan; r++)
    for (let c = column; c < column + columnSpan; c++)
      occupied.add(`${r}:${c}`);
}
