import type {
  ReaderBlock,
  ReaderListBlock,
  ReaderListItem,
} from '../reader-types';

// New imports remap all derived addresses once, including captions and table headers.
// Already accepted packages never pass through this preparation step.
export function remapBlockIds(
  blocks: ReaderBlock[],
  chapterId: string,
): ReaderBlock[] {
  const ids = new Map<string, string>();
  const childId = (old: string, parent: string, suffix: string) => {
    const id = `${parent}::${suffix}`;
    ids.set(old, id);
    return id;
  };
  const remapList = (list: ReaderListBlock, id: string): ReaderListBlock => ({
    ...list,
    id,
    items: list.items.map((item, index) =>
      remapItem(item, childId(item.id, id, `li${index + 1}`)),
    ),
  });
  const remapItem = (item: ReaderListItem, id: string): ReaderListItem => ({
    ...item,
    id,
    ...(item.children
      ? {
          children: item.children.map((child, index) =>
            remapList(child, childId(child.id, id, `list${index + 1}`)),
          ),
        }
      : {}),
  });
  const remapped = blocks.map((block, index) => {
    const id = block.id.startsWith('temp-id')
      ? `${chapterId}::b${index + 1}`
      : block.id;
    ids.set(block.id, id);
    if (block.kind === 'list') return remapList(block, id);
    if (block.kind === 'table')
      return {
        ...block,
        id,
        cells: block.cells.map((cell, index) => ({
          ...cell,
          id: childId(cell.id, id, `cell${index + 1}`),
        })),
      };
    return { ...block, id };
  });
  return remapped.map((block) => {
    if (block.kind === 'image')
      return {
        ...block,
        captionId: block.captionId
          ? (ids.get(block.captionId) ?? block.captionId)
          : block.captionId,
      };
    if (block.kind === 'table')
      return {
        ...block,
        captionId: block.captionId
          ? (ids.get(block.captionId) ?? block.captionId)
          : block.captionId,
        cells: block.cells.map((cell) => ({
          ...cell,
          headerIds: cell.headerIds.map((id) => ids.get(id) ?? id),
        })),
      };
    return block;
  });
}
