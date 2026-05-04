import type { AiCommentLocator } from "@/lib/api-types";

// Class added to every <mark> the highlighter creates. We use it both as a
// styling hook and as the cleanup selector — anything else marked manually
// in the DOM is left alone.
export const AI_COMMENT_MARK_CLASS = "ai-comment-mark";

type CommentForMarking = {
  id: string;
  locator: AiCommentLocator | null;
};

// Wraps every saved AI-comment range inside `article` with a styled <mark>
// element. Designed to run inside a useLayoutEffect that re-fires whenever the
// article's blocks re-render — React replaces text nodes on each render, which
// silently strips our marks, so we always start from a clean slate by
// unwrapping any leftover marks first.
export function applyAiCommentMarks(
  article: HTMLElement,
  comments: readonly CommentForMarking[],
): void {
  unwrapAllMarks(article);

  for (const comment of comments) {
    const locator = comment.locator;
    if (!locator) {
      continue;
    }
    const range = buildRangeFromLocator(article, locator);
    if (!range) {
      continue;
    }
    wrapRangeWithMarks(range, comment.id);
  }
}

// Removes every <mark> the highlighter previously inserted from `article`,
// preserving the wrapped text. Safe to call repeatedly even when no marks
// exist.
export function unwrapAllMarks(article: HTMLElement): void {
  const marks = article.querySelectorAll<HTMLElement>(
    `mark.${AI_COMMENT_MARK_CLASS}`,
  );
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    // Coalesce the freshly-adjacent text nodes left behind so the next
    // `Range.toString()` and probe-range lookups still see one contiguous
    // text run per text region.
    parent.normalize();
  }
}

// Resolves a `(blockId, charOffset)` locator pair into a live DOM Range. Trust
// (blockId, offset) first; if the offsets land outside the block (e.g., text
// reflowed after a re-import), fall back to a text search anchored by
// contextBefore/contextAfter and sourceText.
function buildRangeFromLocator(
  article: HTMLElement,
  locator: AiCommentLocator,
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

  // Guard against zero-length or backwards ranges that can occur if the
  // block's text shrank to less than the saved offset.
  if (
    range.collapsed ||
    range.compareBoundaryPoints(Range.START_TO_END, range) < 0
  ) {
    return null;
  }

  return range;
}

function findBlock(article: HTMLElement, blockId: string): HTMLElement | null {
  // CSS.escape keeps blockIds with `:` (chapterPrefix::blockId) attribute-safe.
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(blockId)
      : blockId.replace(/(["\\\]])/g, "\\$1");
  return article.querySelector<HTMLElement>(`[data-block-id="${escaped}"]`);
}

// Walks text nodes inside `block` until `charOffset` characters have been
// consumed; returns the text node and local offset. If charOffset is past the
// block's total text length, snaps to the end of the last text node — that way
// a slightly-stale offset still produces a usable highlight rather than a
// silent no-op.
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

// `range.surroundContents` only works inside a single text node; cross-node
// ranges would throw `InvalidStateError`. We split the range into one
// sub-range per intersected text node, wrap each in its own <mark>, and keep
// them visually contiguous via a shared CSS class.
function wrapRangeWithMarks(range: Range, commentId: string): void {
  const textNodes = collectTextNodes(range);
  for (const text of textNodes) {
    const localStart = text === range.startContainer ? range.startOffset : 0;
    const localEnd = text === range.endContainer ? range.endOffset : text.data.length;
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
    mark.className = AI_COMMENT_MARK_CLASS;
    mark.dataset.aiCommentId = commentId;
    // Inline styles instead of Tailwind classes: the <mark> is created
    // outside React, so utility classes wouldn't be safelisted. The
    // browser's default <mark> background is yellow — we strip that.
    mark.style.backgroundColor = "transparent";
    mark.style.color = "inherit";
    mark.style.textDecorationLine = "underline";
    mark.style.textDecorationStyle = "solid";
    // Pull the underline color from the theme so it follows light/dark mode.
    // `--title` is the warm brown / cream token used elsewhere for headings.
    mark.style.textDecorationColor = "var(--title)";
    mark.style.textDecorationThickness = "2px";
    mark.style.textUnderlineOffset = "3px";
    mark.style.cursor = "pointer";

    try {
      sub.surroundContents(mark);
    } catch {
      // The text node was mutated mid-iteration, or the range was somehow
      // invalidated — skip and move on.
    }
  }
}

function collectTextNodes(range: Range): Text[] {
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
