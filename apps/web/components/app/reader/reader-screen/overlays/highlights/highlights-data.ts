// Single source of truth for the palette name lives in the store. Re-exported
// here so existing UI imports keep working.
export type { HighlightColor } from "@/lib/highlights-store";
import type { HighlightColor } from "@/lib/highlights-store";

export type Highlight = {
  id: string;
  text: string;
  color: HighlightColor;
  // Chapter title. We don't surface page numbers yet because the EPUB
  // pagination engine paginates per-viewport, so a "page" isn't a stable
  // identifier across devices or font sizes.
  chapterLabel: string;
};

export type HighlightFilter = {
  id: HighlightColor | "all";
  label: string;
  count: number;
};

// CSS background value for each highlight color. We hand back `var(--…)`
// references rather than literal hex codes so the colors swap when the user
// flips between light and dark themes (definitions live in globals.css). The
// light palette is the original soft pastel; the dark palette uses the same
// hues at ~30% lightness so white body text stays legible on top.
export const HIGHLIGHT_COLOR_BG: Record<HighlightColor, string> = {
  apricot: "var(--highlight-apricot)",
  mimosa: "var(--highlight-mimosa)",
  jade: "var(--highlight-jade)",
  sky: "var(--highlight-sky)",
  lavender: "var(--highlight-lavender)",
  rose: "var(--highlight-rose)",
  mauve: "var(--highlight-mauve)",
};

// Stable left-to-right palette order. Used both for the right-panel swatches
// and the left-panel filter chips so the UI stays in sync.
export const HIGHLIGHT_COLOR_ORDER: HighlightColor[] = [
  "apricot",
  "mimosa",
  "jade",
  "sky",
  "lavender",
  "rose",
  "mauve",
];
