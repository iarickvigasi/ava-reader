import type { ReaderChapterPayload, ReaderLocator } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "./navigation";

import { readerContainer, readerLeaves } from "./reader-leaves";
export { readerLeaves } from "./reader-leaves";

export function resolveJumpTarget(
  chapter: ReaderChapterPayload,
  target?: ReaderNavigationTarget,
): ReaderLocator | null {
  const blocks = readerLeaves(chapter.blocks);
  const block = target?.blockId
    ? (blocks.find((item) => item.id === target.blockId) ??
      readerContainer(chapter.blocks, target.blockId))
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
