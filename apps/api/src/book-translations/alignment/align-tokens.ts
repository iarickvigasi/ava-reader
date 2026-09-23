import { z } from 'zod';
import type { AlignmentSpan, SentenceAlignment } from '../types';

export type AlignmentToken = AlignmentSpan & { id: number; text: string };

// Segment the exact persisted text. IDs, rather than model-counted character
// offsets, disambiguate repeated words and keep UTF-16 offsets deterministic.
export function alignmentTokens(
  text: string,
  language: string | null,
): AlignmentToken[] {
  let locale: string | undefined;
  try {
    locale = language ? new Intl.Locale(language).toString() : undefined;
  } catch {
    /* Legacy language name. */
  }
  return Array.from(
    new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
  )
    .filter((part) => part.segment.trim())
    .map((part, id) => ({
      id,
      text: part.segment,
      start: part.index,
      end: part.index + part.segment.length,
    }));
}

export const alignmentOutputSchema = z.object({
  sentences: z.array(
    z.object({
      id: z.string(),
      groups: z.array(
        z.object({
          source: z.array(z.number().int().nonnegative()).min(1),
          translation: z.array(z.number().int().nonnegative()).min(1),
        }),
      ),
    }),
  ),
});

export function resolveAlignment(
  output: z.infer<typeof alignmentOutputSchema>['sentences'][number],
  sourceText: string,
  translatedText: string,
  source: AlignmentToken[],
  translation: AlignmentToken[],
): SentenceAlignment {
  const usedSource = new Set<number>();
  const usedTranslation = new Set<number>();
  const resolve = (
    ids: number[],
    tokens: AlignmentToken[],
    used: Set<number>,
  ): AlignmentSpan[] => {
    const spans: AlignmentSpan[] = [];
    let previousId = -2;
    for (const id of [...ids].sort((a, b) => a - b)) {
      const token = tokens[id];
      if (!token || used.has(id))
        throw new Error('Invalid or overlapping alignment token.');
      used.add(id);
      const previous = spans.at(-1);
      if (previous && id === previousId + 1) previous.end = token.end;
      else spans.push({ start: token.start, end: token.end });
      previousId = id;
    }
    return spans;
  };
  return {
    version: 1,
    sourceText,
    translatedText,
    groups: output.groups.map((group, index) => ({
      id: String(index),
      source: resolve(group.source, source, usedSource),
      translation: resolve(group.translation, translation, usedTranslation),
    })),
  };
}
