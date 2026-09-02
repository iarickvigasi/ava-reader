import { caretRangeAt } from "./caret-range-at";

const NON_SPACE = /\S/;

// The word under (x, y), or null when the point isn't on text inside the page
// box. This is what the long-press selects: with the article non-selectable,
// iOS no longer offers its own word-select (spec 2.6 Behaviour 8).
export function wordRangeAt(
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
): Range | null {
  const caret = caretRangeAt(doc, container, x, y);
  const node = caret?.startContainer;

  if (!caret || !node || node.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const text = (node as Text).data;
  const start = scanWordStart(text, caret.startOffset);
  const end = scanWordEnd(text, caret.startOffset);

  if (start === end) {
    return null;
  }

  const range = doc.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);

  return range;
}

function scanWordStart(text: string, from: number): number {
  let index = from;
  while (index > 0 && NON_SPACE.test(text[index - 1])) {
    index -= 1;
  }
  return index;
}

function scanWordEnd(text: string, from: number): number {
  let index = from;
  while (index < text.length && NON_SPACE.test(text[index])) {
    index += 1;
  }
  return index;
}
