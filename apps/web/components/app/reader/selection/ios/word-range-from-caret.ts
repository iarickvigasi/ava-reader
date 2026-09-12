import { selectionUnitAt } from "./selection-unit-at";
import { textContextFromCaret } from "./text-context-from-caret";
import type { SelectionMode } from "./selection-mode-for-language";

// Affinity is exact: an endpoint at a word's end looks backwards to anchor that
// word, while its start looks forwards. Delimiters never jump to a nearby word.
export function wordRangeFromCaret(
  doc: Document,
  container: HTMLElement,
  caret: Range,
  mode: SelectionMode,
  affinity: "forward" | "backward" = "forward",
): Range | null {
  if (
    !container.isConnected || container.ownerDocument !== doc ||
    !container.contains(caret.startContainer)
  ) return null;

  const context = textContextFromCaret(container, caret);
  if (!context) return null;
  const unit = selectionUnitAt(context.text, context.offset, mode, affinity);
  if (!unit) return null;
  const start = context.runs.find(
    (run) => run.start <= unit.start && unit.start < run.end,
  );
  const end = context.runs.find(
    (run) => run.start < unit.end && unit.end <= run.end,
  );
  if (!start || !end) return null;

  try {
    const range = doc.createRange();
    range.setStart(start.node, unit.start - start.start);
    range.setEnd(end.node, unit.end - end.start);
    return range.collapsed ? null : range;
  } catch {
    // A reflow may replace the text between hit testing and range creation.
    return null;
  }
}
