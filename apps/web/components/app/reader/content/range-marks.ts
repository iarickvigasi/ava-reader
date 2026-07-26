import type { ReaderRangeLocator } from "@/lib/api-types";

// Resolves a `(blockId, charOffset)` locator pair into a live DOM Range.
// Trust (blockId, offset) first; if the offsets land outside the block (e.g.,
// text reflowed after a re-import), this returns null and the caller is
// expected to skip rendering that range. Shared between AI-comment underlines
// and highlight backgrounds because they anchor to the same locator shape.
export function buildRangeFromLocator(
  article: HTMLElement,
  locator: ReaderRangeLocator,
): Range | null {
  const startBlock = findBlock(article, locator.startBlockId);
  const endBlock = findBlock(article, locator.endBlockId);
  if (!startBlock || !endBlock) {
    return null;
  }

  const start = resolveTextPoint(startBlock, locator.startOffset);
  const end = resolveTextPoint(endBlock, locator.endOffset);
  if (!start || !end) {
    return null;
  }

  const range = document.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch {
    return null;
  }

  if (
    range.collapsed ||
    range.compareBoundaryPoints(Range.START_TO_END, range) < 0
  ) {
    return null;
  }

  return range;
}

function findBlock(article: HTMLElement, blockId: string): HTMLElement | null {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(blockId)
      : blockId.replace(/(["\\\]])/g, "\\$1");
  return article.querySelector<HTMLElement>(`[data-block-id="${escaped}"]`);
}

function resolveTextPoint(
  block: HTMLElement,
  charOffset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let remaining = charOffset;
  let lastTextNode: Text | null = null;
  let next = walker.nextNode();
  while (next) {
    const text = next as Text;
    lastTextNode = text;
    if (remaining <= text.data.length) {
      return { node: text, offset: remaining };
    }
    remaining -= text.data.length;
    next = walker.nextNode();
  }
  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.data.length };
  }
  return null;
}

// Removes every <mark> with the given class from `article`, preserving the
// wrapped text. Safe to call repeatedly even when no marks exist.
export function unwrapMarksByClass(
  article: HTMLElement,
  className: string,
): void {
  const marks = article.querySelectorAll<HTMLElement>(`mark.${className}`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

// Walks every text node inside `range`. Used by the per-mark wrappers to
// split a multi-node range into one wrap-per-text-node (since
// surroundContents only works inside a single text node).
export function collectTextNodes(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    return [root as Text];
  }
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      range.intersectsNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  let next = walker.nextNode();
  while (next) {
    result.push(next as Text);
    next = walker.nextNode();
  }
  return result;
}

// Wraps every text-node slice inside `range` in a freshly-created <mark>
// configured by `configure`. Returns the count of marks actually inserted —
// callers can use this to detect "the range disappeared from the DOM" and
// skip downstream work.
export function wrapRangeWithMarks(
  range: Range,
  configure: (mark: HTMLElement) => void,
): number {
  const textNodes = collectTextNodes(range);
  let inserted = 0;
  for (const text of textNodes) {
    const localStart = text === range.startContainer ? range.startOffset : 0;
    const localEnd =
      text === range.endContainer ? range.endOffset : text.data.length;
    if (localEnd <= localStart) {
      continue;
    }
    const sub = document.createRange();
    try {
      sub.setStart(text, localStart);
      sub.setEnd(text, localEnd);
    } catch {
      continue;
    }
    const mark = document.createElement("mark");
    configure(mark);
    try {
      sub.surroundContents(mark);
      inserted += 1;
    } catch {
      // The text node was mutated mid-iteration, or the range was somehow
      // invalidated — skip and move on.
    }
  }
  return inserted;
}
