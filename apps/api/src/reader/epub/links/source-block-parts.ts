import type {
  ReaderBlock,
  ReaderListItem,
  ReaderTableCell,
} from '../../reader-types';

export function sourceBlockParts(
  blocks: ReaderBlock[],
): (ReaderBlock | ReaderListItem | ReaderTableCell)[] {
  return blocks.flatMap((block) => {
    if (block.kind === 'table') return [block, ...block.cells];
    if (block.kind === 'list')
      return [
        block,
        ...block.items.flatMap((item) => [
          item,
          ...sourceBlockParts(item.children ?? []),
        ]),
      ];
    return [block];
  });
}
