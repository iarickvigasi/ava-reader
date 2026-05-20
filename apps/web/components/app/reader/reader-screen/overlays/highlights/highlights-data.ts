import type { HighlightColor } from "@/features/highlights";

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

// Inverse-theme background — resolves to the other theme's palette value so
// a chip painted in this color stays visible on the current paper. Use for
// labels/badges that the same-theme pastel would wash out.
export const HIGHLIGHT_COLOR_BG_INVERSE: Record<HighlightColor, string> = {
  apricot: "var(--highlight-apricot-inverse)",
  mimosa: "var(--highlight-mimosa-inverse)",
  jade: "var(--highlight-jade-inverse)",
  sky: "var(--highlight-sky-inverse)",
  lavender: "var(--highlight-lavender-inverse)",
  rose: "var(--highlight-rose-inverse)",
  mauve: "var(--highlight-mauve-inverse)",
};

// Type guard so callers can validate a free-form server string against the
// palette before keying the maps above.
export function isHighlightColor(value: string): value is HighlightColor {
  return (HIGHLIGHT_COLOR_ORDER as readonly string[]).includes(value);
}

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
