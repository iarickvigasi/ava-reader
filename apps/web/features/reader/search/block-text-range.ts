import { collectTextNodeSegments } from "../measurement/dom-segments";

export function blockTextRange(
  block: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const segments = collectTextNodeSegments(block);
  const range = block.ownerDocument.createRange();
  let offset = 0;
  let hasStart = false;
  for (const { node, length } of segments) {
    if (!hasStart && start < offset + length) {
      range.setStart(node, Math.max(0, start - offset));
      hasStart = true;
    }
    if (hasStart && end <= offset + length) {
      range.setEnd(node, end - offset);
      return range;
    }
    offset += length;
  }
  return null;
}
