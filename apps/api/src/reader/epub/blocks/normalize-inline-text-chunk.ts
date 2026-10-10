import type { ReaderInline } from '../../reader-types';
import type { InlineOptions } from './inline-options';
import { mappedInlineText, validateInlineTextMap } from './mapped-inline-text';

export function normalizeInlineTextChunk(
  inlines: ReaderInline[],
  options: InlineOptions,
  trimStart: boolean,
  trimEnd: boolean,
): ReaderInline[] {
  const source = inlines
    .filter((i) => i.kind === 'text')
    .map((i) => i.text)
    .join('');
  const rules: [RegExp, string][] = options.literal
    ? []
    : [
        [/[ \t]+\n/g, '\n'],
        [/\n[ \t]+/g, '\n'],
        [/[ \t]{2,}/g, ' '],
        ...(trimStart ? [[/^\s+/g, ''] as [RegExp, string]] : []),
        ...(trimEnd ? [[/\s+$/g, ''] as [RegExp, string]] : []),
      ];
  const { text, boundaryUtf16: map } = mappedInlineText(source, rules);
  let cursor = 0;
  return inlines.flatMap((inline): ReaderInline[] => {
    if (inline.kind !== 'text') return [inline];
    const start = cursor;
    cursor += inline.text.length;
    const stored = text.slice(map[start], map[cursor]);
    const raw = inline.sourceNormalization?.sourceText ?? inline.text;
    const prior =
      inline.sourceNormalization?.boundaryUtf16 ??
      Array.from({ length: raw.length + 1 }, (_, i) => i);
    validateInlineTextMap(raw, inline.text, prior);
    const boundaries = prior.map((offset) => map[start + offset] - map[start]);
    validateInlineTextMap(raw, stored, boundaries);
    const rest = { ...inline };
    delete rest.sourceNormalization;
    // A fully trimmed source run still records where its UTF-16 boundaries went.
    if (!stored && !raw && !inline.anchorIds?.length && !inline.href) return [];
    return [
      {
        ...rest,
        text: stored,
        ...(raw === stored
          ? {}
          : {
              sourceNormalization: {
                sourceText: raw,
                boundaryUtf16: boundaries,
              },
            }),
      },
    ];
  });
}
