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
  const range = createCharacterRange(
    collectTextNodeSegments(element),
    textOffset,
  );
  const rect =
    (range && getRangeRect(range)) ?? element.getBoundingClientRect();
  const cell = element.closest?.<HTMLElement>("td, th");
  // Bilingual fragments focus a nested span; its offset still belongs to that
  // span, but a fitting containing cell supplies readable context. Never use
  // a cell outside the current nested scroll region.
  const context =
    cell && readerTableViewport(cell) === viewport ? cell : element;
  const contextRect = context.getBoundingClientRect();
  const horizontal =
    contextRect.right - contextRect.left <= viewport.clientWidth
      ? contextRect
      : rect;
  const vertical =
    contextRect.bottom - contextRect.top <= viewport.clientHeight
      ? contextRect
      : rect;
  const bounds = viewport.getBoundingClientRect();
  const left = bounds.left + viewport.clientLeft;
  const top = bounds.top + viewport.clientTop;
  viewport.scrollLeft += nearestScroll(
    horizontal.left,
    horizontal.right,
    left,
    left + viewport.clientWidth,
  );
  viewport.scrollTop += nearestScroll(
    vertical.top,
    vertical.bottom,
    top,
    top + viewport.clientHeight,
  );
}

function nearestScroll(start: number, end: number, near: number, far: number) {
  if (start < near || end - start > far - near) return start - near;
  return end > far ? end - far : 0;
}
