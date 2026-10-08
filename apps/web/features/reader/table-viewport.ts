import {
  collectTextNodeSegments,
  createCharacterRange,
  getRangeRect,
} from "./measurement/dom-segments";

export function readerTableViewport(element: HTMLElement) {
  return element.closest?.<HTMLElement>("[data-reader-table-scroll]") ?? null;
}

// Content inside a table scroll box belongs to the box's reading page, even
// when a wide cell is currently outside its local horizontal viewport.
export function readerPageRect(element: HTMLElement) {
  return (readerTableViewport(element) ?? element).getBoundingClientRect();
}

export function revealTablePassage(element: HTMLElement, textOffset: number) {
  const viewport = readerTableViewport(element);
  if (!viewport) return;
  const range = createCharacterRange(collectTextNodeSegments(element), textOffset);
  const rect = (range && getRangeRect(range)) ?? element.getBoundingClientRect();
  const bounds = viewport.getBoundingClientRect();
  const left = bounds.left + viewport.clientLeft;
  const top = bounds.top + viewport.clientTop;
  viewport.scrollLeft += nearestScroll(
    rect.left, rect.right, left, left + viewport.clientWidth,
  );
  viewport.scrollTop += nearestScroll(
    rect.top, rect.bottom, top, top + viewport.clientHeight,
  );
}

function nearestScroll(start: number, end: number, near: number, far: number) {
  if (start < near || end - start > far - near) return start - near;
  return end > far ? end - far : 0;
}
