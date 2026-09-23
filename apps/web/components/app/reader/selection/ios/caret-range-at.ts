// caretRangeFromPoint is WebKit's (still unprefixed, still non-standard) way
// to turn a screen point into a text position; the iOS gesture is built on it
// because `user-select: none` takes the native hit-testing away.
type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => { offsetNode: Node; offset: number } | null;
};

export function caretRangeAt(
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
): Range | null {
  let caret = (doc as CaretDocument).caretRangeFromPoint?.(x, y) ?? null;
  if (!caret) {
    const point = (doc as CaretDocument).caretPositionFromPoint?.(x, y);
    if (point) {
      caret = doc.createRange();
      caret.setStart(point.offsetNode, point.offset);
      caret.collapse(true);
    }
  }

  if (!caret || !container.contains(caret.startContainer)) {
    return null;
  }

  return caret;
}
