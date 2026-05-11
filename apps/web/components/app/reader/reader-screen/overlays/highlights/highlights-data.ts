// Single source of truth for the palette name lives in the store. Re-exported
// here so existing UI imports keep working.
export type { HighlightColor } from "@/lib/highlights-store";
import type { HighlightColor } from "@/lib/highlights-store";

export type Highlight = {
  id: string;
  text: string;
  color: HighlightColor;
  // Chapter label, since exact page numbers aren't available on day one and
  // chapter is a stable enough locator for the user's eye.
  pageLabel: string;
};

export type HighlightFilter = {
  id: HighlightColor | "all";
  label: string;
  count: number;
};

// Hex tokens for each highlight color. These live alongside the data because
// they're specific to the highlights palette and aren't reused elsewhere yet.
export const HIGHLIGHT_COLOR_HEX: Record<HighlightColor, string> = {
  apricot: "#fdddc9",
  mimosa: "#fbe7cb",
  jade: "#d7e7d4",
  sky: "#d7e8f7",
  lavender: "#d7d0ff",
  rose: "#ffd8e0",
  mauve: "#f4d9f7",
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
