import type { ReaderRangeLocator } from "@/lib/api-types";
import type { HighlightColor } from "@/features/highlights";
import { HIGHLIGHT_COLOR_BG } from "../overlays/highlights/highlights-data";
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
    const backgroundColor = HIGHLIGHT_COLOR_BG[highlight.color];
    wrapRangeWithMarks(range, (mark) => {
      mark.className = HIGHLIGHT_MARK_CLASS;
      mark.dataset.highlightId = highlight.id;
      mark.dataset.highlightColor = highlight.color;
      mark.style.backgroundColor = backgroundColor;
      // The default <mark> color is a near-black; force inherit so the
      // highlight reads as a translucent wash under the body text.
      mark.style.color = "inherit";
      mark.style.cursor = "pointer";
    });
  }

  roundHighlightEnds(article);
  liftItalicMarks(article);
}

// Italic glyphs overflow past their inline box's right edge. When the next
// adjacent <mark>'s background paints — which happens after the italic mark's
// text in normal flow — it covers that overflow and the trailing glyph looks
// chopped vertically. Promoting italic marks to `position: relative` moves
// them into the positioned-painting pass, which runs after in-flow inline
// backgrounds, so the overflowing glyph stays on top.
function liftItalicMarks(article: HTMLElement): void {
  const marks = article.querySelectorAll<HTMLElement>(
    `mark.${HIGHLIGHT_MARK_CLASS}`,
  );
  for (const mark of marks) {
    if (getComputedStyle(mark).fontStyle !== "normal") {
      mark.style.position = "relative";
    }
  }
}

// A single highlight that crosses inline boundaries (e.g. an <em>) becomes
// multiple adjacent <mark>s. Padding/rounding every segment renders them as
// separate pills with visible seams, and italic glyphs that overflow their
// box get clipped by the next segment's rounded left edge. Apply the pill
// shape only at the outer ends of each highlight so it reads as one wash.
function roundHighlightEnds(article: HTMLElement): void {
  const groups = new Map<string, HTMLElement[]>();
  const marks = article.querySelectorAll<HTMLElement>(
    `mark.${HIGHLIGHT_MARK_CLASS}`,
  );
  for (const mark of marks) {
    const id = mark.dataset.highlightId;
    if (!id) continue;
    const list = groups.get(id);
    if (list) {
      list.push(mark);
    } else {
      groups.set(id, [mark]);
    }
  }
  for (const list of groups.values()) {
    const first = list[0];
    first.style.paddingLeft = "2px";
    first.style.borderTopLeftRadius = "8px";
    first.style.borderBottomLeftRadius = "8px";
    const last = list[list.length - 1];
    last.style.paddingRight = "2px";
    last.style.borderTopRightRadius = "8px";
    last.style.borderBottomRightRadius = "8px";
  }
}

export function unwrapAllHighlightMarks(article: HTMLElement): void {
  unwrapMarksByClass(article, HIGHLIGHT_MARK_CLASS);
}
