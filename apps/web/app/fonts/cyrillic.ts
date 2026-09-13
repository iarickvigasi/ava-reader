import localFont from "next/font/local";

// Script-only faces come before next/font's Latin/system fallback stacks.
// Sizes and line metrics match Afacad and Abhaya Libre; see README.md.
export const cyrillicBody = localFont({
  src: "./nunito-sans-cyrillic.woff2",
  variable: "--font-cyrillic-body",
  weight: "400 700",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0300-0301,U+0308,U+0400-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    },
    { prop: "size-adjust", value: "88.65%" },
    { prop: "ascent-override", value: "112.8032%" },
    { prop: "descent-override", value: "37.6011%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

export const cyrillicDisplay = localFont({
  src: "./source-serif-4-cyrillic.woff2",
  variable: "--font-cyrillic-display",
  weight: "400 800",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0300-0301,U+0308,U+0400-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    },
    { prop: "size-adjust", value: "87.4%" },
    { prop: "ascent-override", value: "96.092%" },
    { prop: "descent-override", value: "38.8837%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});
