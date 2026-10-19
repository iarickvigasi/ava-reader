export type InlineTextMap = { sourceText: string; boundaryUtf16: number[] };
type MappedText = { text: string; boundaryUtf16: number[] };

// Map every source UTF16 boundary while applying the declared whitespace rules.
export function mappedInlineText(
  source: string,
  rules: [RegExp, string][],
): MappedText {
  let text = source;
  let boundaryUtf16 = Array.from({ length: source.length + 1 }, (_, i) => i);
  for (const [pattern, replacement] of rules) {
    const next = replaceMapped(text, pattern, replacement);
    boundaryUtf16 = boundaryUtf16.map((offset) => next.boundaryUtf16[offset]);
    text = next.text;
  }
  validateInlineTextMap(source, text, boundaryUtf16);
  return { text, boundaryUtf16 };
}
function replaceMapped(
  source: string,
  pattern: RegExp,
  replacement: string,
): MappedText {
  const boundaries = new Array<number>(source.length + 1);
  let text = '';
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    for (let i = cursor; i <= start; i++)
      boundaries[i] = text.length + i - cursor;
    text += source.slice(cursor, start);
    for (let i = start; i < start + match[0].length; i++)
      boundaries[i] = text.length;
    text += replacement;
    cursor = start + match[0].length;
    boundaries[cursor] = text.length;
  }
  for (let i = cursor; i <= source.length; i++)
    boundaries[i] = text.length + i - cursor;
  text += source.slice(cursor);
  return { text, boundaryUtf16: boundaries };
}
export function validateInlineTextMap(
  source: string,
  text: string,
  map: number[],
) {
  if (
    map.length !== source.length + 1 ||
    map[0] !== 0 ||
    map.at(-1) !== text.length ||
    map.some(
      (value, i) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > text.length ||
        (i > 0 && value < map[i - 1]),
    )
  )
    throw new Error('The EPUB text normalization map is invalid.');
  for (let i = 0; i <= source.length; i++) {
    if (!insideSurrogate(source, i) && insideSurrogate(text, map[i]))
      throw new Error(
        'The EPUB text normalization splits a Unicode character.',
      );
  }
}
function insideSurrogate(text: string, offset: number) {
  return (
    offset > 0 &&
    offset < text.length &&
    /[\uD800-\uDBFF]/.test(text[offset - 1]) &&
    /[\uDC00-\uDFFF]/.test(text[offset])
  );
}
