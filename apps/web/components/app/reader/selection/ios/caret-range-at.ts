// caretRangeFromPoint is WebKit's (still unprefixed, still non-standard) way
// to turn a screen point into a text position; the iOS gesture is built on it
// because `user-select: none` takes the native hit-testing away.
type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export function caretRangeAt(
  doc: Document,
  container: HTMLElement,
  x: number,
  y: number,
): Range | null {
  const caret = (doc as CaretDocument).caretRangeFromPoint?.(x, y) ?? null;

  if (!caret || !container.contains(caret.startContainer)) {
    return null;
  }

  return caret;
}
