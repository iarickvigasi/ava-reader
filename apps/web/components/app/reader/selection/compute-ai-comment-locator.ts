import type { ReaderRangeLocator } from "@/lib/api-types";
import { sourceOffsetWithin } from "./source-offset-within";
import { computeSelectionRangeContext } from "./selection-range-context";

// Builds a serialisable position fingerprint for `range`. Returns null when the
// range straddles non-block content or escapes the chapter article — in those
// cases the caller should send the AI request without a locator (the comment
// just won't be re-anchorable later).
//
// `fallbackChapterId` is used only if the start block lacks a data-chapter-id
// attribute (shouldn't happen in practice — every block carries one — but
// keeps the helper robust against template drift).
export function computeAiCommentLocator(
  range: Range,
  fallbackChapterId: string,
): ReaderRangeLocator | null {
  const startBlock = findBlockElement(range.startContainer);
  const endBlock = findBlockElement(range.endContainer);
  if (!startBlock || !endBlock) {
    return null;
  }

  const startBlockId = startBlock.dataset.blockId;
  const endBlockId = endBlock.dataset.blockId;
  if (!startBlockId || !endBlockId) {
    return null;
  }

  // Derive chapter id from the *start* block. This is what makes the
  // attribution correct when the user selects within a prefix (previous
  // chapter) or spillover (next chapter) block rendered alongside the active
  // chapter.
  const chapterId = startBlock.dataset.chapterId ?? fallbackChapterId;

  const startOffset = sourceOffsetWithin(
    startBlock,
    range.startContainer,
    range.startOffset,
  );
  const endOffset = sourceOffsetWithin(
    endBlock,
    range.endContainer,
    range.endOffset,
  );
  if (startOffset == null || endOffset == null) {
    return null;
  }

  const { contextBefore, contextAfter } = computeSelectionRangeContext(range);

  return {
    chapterId,
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
    contextBefore,
    contextAfter,
  };
}

// Walks ancestors of `node` until it finds a block element (one with a
// data-block-id attribute set by ReaderBlockView). Returns null if no block
// ancestor exists — typically because the selection is outside the article.
function findBlockElement(node: Node): HTMLElement | null {
  let current: Node | null =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.dataset.blockId !== undefined
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}
