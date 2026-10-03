import type {
  ReaderBlock,
  ReaderListBlock,
} from "@/lib/api-types/reader-content";
export function canonicalLeaf(
  block: ReaderBlock,
  id: string,
): ReaderBlock | undefined {
  if (block.id === id) return block;
  if (block.kind === "table") {
    const cell = block.cells.find((c) => c.id === id);
    return cell ? { ...cell, kind: "paragraph" } : undefined;
  }
  const find = (list: ReaderListBlock): ReaderBlock | undefined => {
    for (const item of list.items) {
      if (item.id === id) return { ...item, kind: "paragraph" };
      for (const child of item.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
    }
  };
  return block.kind === "list" && block.canonical ? find(block) : undefined;
}
