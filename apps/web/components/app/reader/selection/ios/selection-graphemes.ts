const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
const UNSAFE_FALLBACK =
  /[\p{Mark}\p{Grapheme_Extend}\p{Format}\p{Regional_Indicator}\p{Emoji_Modifier}]/u;
const UNSAFE_SCRIPT =
  /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Common}\p{Script=Inherited}]/u;

export function selectionGraphemes(text: string) {
  if (segmenter) {
    return Array.from(segmenter.segment(text), ({ segment, index }) => ({ segment, index }));
  }

  // Older engines may use code points only when no multi-code-point grapheme
  // can be split. Refuse risky text instead of selecting half a visible symbol.
  if (UNSAFE_SCRIPT.test(text) || UNSAFE_FALLBACK.test(text.replace(/[\u00ad\u200b]/g, ""))) {
    return null;
  }

  let index = 0;
  return Array.from(text, (segment) => {
    const grapheme = { segment, index };
    index += segment.length;
    return grapheme;
  });
}
