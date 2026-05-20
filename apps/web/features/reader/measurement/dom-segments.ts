// DOM walking helpers — block lookup, text-node enumeration, character
// ranges, and the rect picker. The bridge between locator coordinates
// (blockId + textOffset) and on-screen rectangles.

import { resolveTextOffsetTarget } from "../locator-dom";

export type TextNodeSegment = {
  length: number;
  node: Text;
};

export function findBlockElement(article: HTMLElement, blockId: string) {
  for (const blockElement of article.querySelectorAll<HTMLElement>(
    "[data-reader-block='true']",
  )) {
    if (blockElement.dataset.blockId === blockId) {
      return blockElement;
    }
  }

  return null;
}

export function collectTextNodeSegments(root: HTMLElement) {
  if (root.dataset.readerBlockKind === "image") {
    return [] satisfies TextNodeSegment[];
  }

  const segments: TextNodeSegment[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!(node instanceof Text) || node.data.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.parentElement?.closest("noscript, script, style")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    segments.push({
      length: textNode.data.length,
      node: textNode,
    });
    currentNode = walker.nextNode();
  }

  return segments;
}

export function createCharacterRange(
  segments: ReadonlyArray<TextNodeSegment>,
  textOffset: number,
) {
  const target = resolveTextOffsetTarget(segments, textOffset);

  if (!target) {
    return null;
  }

  const segment = segments[target.nodeIndex];

  if (!segment || segment.length <= 0) {
    return null;
  }

  const range = segment.node.ownerDocument.createRange();
  range.setStart(segment.node, target.offsetInNode);
  range.setEnd(segment.node, Math.min(target.offsetInNode + 1, segment.length));

  return range;
}

export function getRangeRect(range: Range) {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );

  if (rects.length > 0) {
    return rects[0];
  }

  const boundingRect = range.getBoundingClientRect();

  return boundingRect.width > 0 || boundingRect.height > 0
    ? boundingRect
    : null;
}
