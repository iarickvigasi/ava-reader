import type { ReaderRangeLocator } from "@/lib/api-types";
import {
  HIGHLIGHT_COLOR_HEX,
  type HighlightColor,
} from "../overlays/highlights/highlights-data";
import {
  buildRangeFromLocator,
  unwrapMarksByClass,
  wrapRangeWithMarks,
} from "./range-marks";

// Class added to every <mark> the user-highlight highlighter creates. Distinct
// from the AI-comment class so we can paint both on the same span without
// clobbering each other.
export const HIGHLIGHT_MARK_CLASS = "reader-highlight-mark";

type HighlightForMarking = {
  id: string;
  color: HighlightColor;
  locator: ReaderRangeLocator | null;
};

// Wraps every persisted highlight inside `article` with a styled <mark>.
// Runs together with applyAiCommentMarks: highlight backgrounds first, then
// AI underlines layered on top, so the two can coexist on the same text.
export function applyHighlightMarks(
  article: HTMLElement,
  highlights: readonly HighlightForMarking[],
): void {
  unwrapMarksByClass(article, HIGHLIGHT_MARK_CLASS);

  for (const highlight of highlights) {
    const locator = highlight.locator;
    if (!locator) {
      continue;
    }
    const range = buildRangeFromLocator(article, locator);
    if (!range) {
      continue;
    }
    const backgroundColor = HIGHLIGHT_COLOR_HEX[highlight.color];
    wrapRangeWithMarks(range, (mark) => {
      mark.className = HIGHLIGHT_MARK_CLASS;
      mark.dataset.highlightId = highlight.id;
      mark.dataset.highlightColor = highlight.color;
      mark.style.backgroundColor = backgroundColor;
      // The default <mark> color is a near-black; force inherit so the
      // highlight reads as a translucent wash under the body text.
      mark.style.color = "inherit";
      mark.style.borderRadius = "2px";
      mark.style.cursor = "pointer";
    });
  }
}

export function unwrapAllHighlightMarks(article: HTMLElement): void {
  unwrapMarksByClass(article, HIGHLIGHT_MARK_CLASS);
}
