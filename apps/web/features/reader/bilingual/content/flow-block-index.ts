import type {
  ReaderBlock,
  ReaderListBlock,
} from "@/lib/api-types/reader-content";
/** Source leaves keep their own offsets and share the enclosing flow layout. */
export function flowBlockIndex(blocks: ReaderBlock[]) {
  const index = new Map<string, ReaderBlock>();
  const list = (block: ReaderListBlock, root: ReaderBlock) => {
    index.set(block.id, root);
    for (const item of block.items) {
      index.set(item.id, root);
      for (const child of item.children ?? []) list(child, root);
    }
  };
  for (const block of blocks) {
    index.set(block.id, block);
    if (block.kind === "table")
      for (const cell of block.cells) index.set(cell.id, block);
    if (block.kind === "list") list(block, block);
  }
  return index;
}
