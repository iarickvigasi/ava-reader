export type HighlightColor =
  | "apricot"
  | "mimosa"
  | "jade"
  | "sky"
  | "lavender"
  | "rose"
  | "mauve";

export type Highlight = {
  id: string;
  text: string;
  color: HighlightColor;
  pageNumber: number;
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

export const SAMPLE_HIGHLIGHT_FILTERS: HighlightFilter[] = [
  { id: "all", label: "All", count: 15 },
  { id: "apricot", label: "Apricot", count: 3 },
  { id: "mimosa", label: "Mimosa", count: 78 },
  { id: "jade", label: "Jade", count: 4 },
  { id: "sky", label: "Sky", count: 8 },
  { id: "lavender", label: "Lavender", count: 12 },
  { id: "rose", label: "Rose", count: 2 },
  { id: "mauve", label: "Mauve", count: 56 },
];

// Sample content used while the panel is UI-only. Replace with real data when
// the highlight backend is wired in.
export const SAMPLE_HIGHLIGHTS: Highlight[] = [
  {
    id: "highlight-1",
    text: "A reader lives a thousand lives before they die",
    color: "apricot",
    pageNumber: 24,
  },
  {
    id: "highlight-2",
    text: "I find television very educating. Every time somebody turns on the set, I go into the other room and read a book.",
    color: "apricot",
    pageNumber: 36,
  },
  {
    id: "highlight-3",
    text: "Books are a uniquely portable magic.",
    color: "apricot",
    pageNumber: 57,
  },
  {
    id: "highlight-4",
    text: "A reader lives a thousand lives before they die",
    color: "apricot",
    pageNumber: 24,
  },
  {
    id: "highlight-5",
    text: "I find television very educating. Every time somebody turns on the set, I go into the other room and read a book.",
    color: "apricot",
    pageNumber: 36,
  },
  {
    id: "highlight-6",
    text: "I kept always two books in my pocket, one to read, one to write in.",
    color: "apricot",
    pageNumber: 76,
  },
  {
    id: "highlight-7",
    text: "I have a passion for teaching kids to become readers, to become comfortable with a book, not daunted. Books shouldn’t be daunting, they should be funny, exciting and wonderful; and learning to be a reader gives a terrific advantage.",
    color: "apricot",
    pageNumber: 24,
  },
];
