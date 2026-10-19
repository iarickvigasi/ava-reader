import type { ReaderBlock } from "@/lib/api-types";

export function readerLeaves(
  blocks: ReaderBlock[],
  legacyContainerId?: string,
): ReaderBlock[] {
  return blocks.flatMap((block): ReaderBlock[] => {
    if (
      block.id === legacyContainerId &&
      (block.kind === "table" || (block.kind === "list" && !block.canonical))
    )
      return [block];
    if (block.kind === "table")
      return block.cells.length
        ? block.cells.map((cell) => ({
            ...cell,
            kind: "paragraph" as const,
          }))
        : [block];
    if (block.kind !== "list" || !block.items.length) return [block];
    return block.items.flatMap((item) => [
      { ...item, kind: "paragraph" as const },
      ...readerLeaves(item.children ?? [], legacyContainerId),
    ]);
  });
}

// Previously stored ordinary EPUB positions can address the whole list. Keep
// those explicit destinations while search and new progress use actual leaves.
export function readerContainer(
  blocks: ReaderBlock[],
  id: string,
): ReaderBlock | undefined {
  for (const block of blocks) {
    if (
      block.id === id &&
      (block.kind === "table" || (block.kind === "list" && !block.canonical))
    )
      return block;
    if (block.kind === "list") {
      const nested = readerContainer(
        block.items.flatMap((item) => item.children ?? []),
        id,
      );
      if (nested) return nested;
    }
  }
}
