import localFont from "next/font/local";

export const display = localFont({
  src: [
    { path: "./abhaya-libre-400.woff2", weight: "400", style: "normal" },
    { path: "./abhaya-libre-700.woff2", weight: "700", style: "normal" },
    { path: "./abhaya-libre-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-abhaya",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const body = localFont({
  src: "./afacad.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-afacad",
  display: "swap",
});

export const ui = localFont({
  src: "./inter.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

export const readerSerif = localFont({
  src: [
    { path: "./noto-serif.woff2", weight: "400 700", style: "normal" },
    { path: "./noto-serif-italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-reader-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
