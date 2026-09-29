import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderLocator,
} from "@/lib/api-types";
import type { ReaderNavigationTarget } from "./navigation";

export function readerLeaves(blocks: ReaderBlock[]): ReaderBlock[] {
  return blocks.flatMap((block): ReaderBlock[] => {
    if (block.kind === "table")
      return [
        block,
        ...block.cells.map((cell) => ({ ...cell, kind: "paragraph" as const })),
      ];
    if (block.kind !== "list" || !block.canonical) return [block];
    return block.items.flatMap((item) => [
      { ...item, kind: "paragraph" as const },
      ...readerLeaves(item.children ?? []),
    ]);
  });
}

export function resolveJumpTarget(
  chapter: ReaderChapterPayload,
  target?: ReaderNavigationTarget,
): ReaderLocator | null {
  const blocks = readerLeaves(chapter.blocks);
  const block = target?.blockId
    ? blocks.find((item) => item.id === target.blockId)
    : target?.edge === "end"
      ? blocks.at(-1)
      : blocks[0];
  if (!block) return null;
  const textOffset = target?.textOffset ?? 0;
  if (
    !Number.isInteger(textOffset) ||
    textOffset < 0 ||
    textOffset > block.text.length
  )
    return null;
  if (
    block.canonicalText &&
    !block.canonicalText.codepoint_utf16.includes(textOffset)
  )
    return null;
  return { chapterId: chapter.chapterId, blockId: block.id, textOffset };
}

export function sameReaderPlace(
  a: ReaderLocator | null,
  b: ReaderLocator | null,
) {
  return Boolean(
    a &&
    b &&
    a.chapterId === b.chapterId &&
    a.blockId === b.blockId &&
    a.textOffset === b.textOffset,
  );
}
