import { selectionGraphemes } from "./selection-graphemes";
import type { SelectionMode } from "./selection-mode-for-language";

const DELIMITER = /[\s\p{Dash_Punctuation}\u200b]/u;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const WORD_CONTENT = /[\p{Letter}\p{Number}]/u;

// Offsets are DOM (UTF-16) caret positions. Affinity owns the grapheme on that
// side of an exact boundary; inside a grapheme either side selects it whole.
export function selectionUnitAt(
  text: string,
  offset: number,
  mode: SelectionMode,
  affinity: "forward" | "backward" = "forward",
): { start: number; end: number } | null {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return null;

  const graphemes = selectionGraphemes(text);
  if (!graphemes) return null;

  const selected = graphemes.findIndex(({ index, segment }) =>
    affinity === "forward"
      ? index <= offset && offset < index + segment.length
      : index < offset && offset <= index + segment.length,
  );
  if (selected < 0 || DELIMITER.test(graphemes[selected].segment)) return null;

  let first = selected;
  let last = selected;
  if (mode === "word" && isWordGrapheme(graphemes[selected].segment)) {
    while (first > 0 && isWordGrapheme(graphemes[first - 1].segment)) first -= 1;
    while (last + 1 < graphemes.length && isWordGrapheme(graphemes[last + 1].segment)) last += 1;
  }

  const start = graphemes[first].index;
  const end = graphemes[last].index + graphemes[last].segment.length;
  if (WORD_CONTENT.test(text.slice(start, end))) return { start, end };

  // Punctuation attaches to words, but punctuation-only runs and emoji each
  // select one visible symbol. Selection mode comes from the book metadata.
  const { index, segment } = graphemes[selected];
  return { start: index, end: index + segment.length };
}

function isWordGrapheme(segment: string): boolean {
  return !DELIMITER.test(segment) && !EMOJI.test(segment);
}
