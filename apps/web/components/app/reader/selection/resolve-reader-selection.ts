import type { ReaderSelection } from "./types";

export function resolveReaderSelection(
  selection: Selection | null,
  container: HTMLElement | null,
): ReaderSelection | null {
  if (
    !selection ||
    !container ||
    selection.rangeCount === 0 ||
    selection.isCollapsed
  ) {
    return null;
  }

  const text = selection.toString().trim();
  if (text.length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  return { text, range };
}
