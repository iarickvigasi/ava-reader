import type { ReaderRangeLocator } from "@/lib/api-types";

// Number of characters of surrounding text we capture on each side of the
// selection. Wide enough to disambiguate the same phrase appearing twice in a
// chapter, narrow enough to keep the serialized locator under a few hundred
// bytes.
const CONTEXT_CHAR_COUNT = 30;

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

  const startOffset = offsetWithin(
    startBlock,
    range.startContainer,
    range.startOffset,
  );
  const endOffset = offsetWithin(
    endBlock,
    range.endContainer,
    range.endOffset,
  );
  if (startOffset == null || endOffset == null) {
    return null;
  }

  const { contextBefore, contextAfter } = computeContext(range);

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

// Character offset of (node, nodeOffset) within `block`, measured against the
// flat textContent of the block. Uses a probe Range so that mixed text/element
// containers (paragraphs with <em>, lists with <li>, etc.) all collapse to a
// single linear offset.
function offsetWithin(
  block: HTMLElement,
  node: Node,
  nodeOffset: number,
): number | null {
  if (!block.contains(node) && node !== block) {
    return null;
  }
  const probe = document.createRange();
  try {
    probe.setStart(block, 0);
    probe.setEnd(node, nodeOffset);
  } catch {
    return null;
  }
  return probe.toString().length;
}

function computeContext(range: Range): {
  contextBefore: string;
  contextAfter: string;
} {
  const article = findArticleElement(range.startContainer);
  if (!article) {
    return { contextBefore: "", contextAfter: "" };
  }

  let contextBefore = "";
  let contextAfter = "";

  const beforeRange = document.createRange();
  try {
    beforeRange.setStart(article, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    contextBefore = beforeRange.toString().slice(-CONTEXT_CHAR_COUNT);
  } catch {
    // Fall through with empty contextBefore.
  }

  const afterRange = document.createRange();
  try {
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(article);
    contextAfter = afterRange.toString().slice(0, CONTEXT_CHAR_COUNT);
  } catch {
    // Fall through with empty contextAfter.
  }

  return { contextBefore, contextAfter };
}

function findArticleElement(node: Node): HTMLElement | null {
  let current: Node | null =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (current) {
    if (current instanceof HTMLElement && current.tagName === "ARTICLE") {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}
