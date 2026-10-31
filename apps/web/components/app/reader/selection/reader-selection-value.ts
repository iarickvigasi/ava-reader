import type { ReaderRangeLocator } from "@/lib/api-types";
import type { HighlightColor } from "@/features/offline/buckets/highlights";
import type { SelectionPointer } from "./types";

export type ReaderSelectionContextValue = {
  text: string | null;
  locator: ReaderRangeLocator | null;
  context: string | null;
  contextOffset: number | null;
  // Which input built the captured selection; null when the panel was opened
  // from a click on an existing highlight/comment rather than a live capture.
  // The AI toolbox drops the live selection on open for "touch" captures.
  pointer: SelectionPointer | null;
  // When the panel is open against an existing highlight (because the user
  // clicked one in the article, or because we matched their fresh selection
  // to a stored highlight), these point at the row the swatch click should
  // operate on. Null when the selection hasn't produced/matched a highlight.
  highlightId: string | null;
  highlightColor: HighlightColor | null;
  setSelection: (next: {
    text: string;
    locator: ReaderRangeLocator | null;
    pointer?: SelectionPointer | null;
    context?: string | null;
    contextOffset?: number | null;
    highlightId?: string | null;
    highlightColor?: HighlightColor | null;
  }) => void;
  setHighlightBinding: (
    next: { highlightId: string; highlightColor: HighlightColor } | null,
  ) => void;
  clearSelection: () => void;
};
