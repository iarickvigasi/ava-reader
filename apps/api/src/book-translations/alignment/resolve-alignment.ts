import type { AlignmentSpan, SentenceAlignment } from '../types';
import type { AlignmentToken } from './alignment-tokens';
import {
  AlignmentValidationError,
  type AlignmentOutput,
} from './alignment-output';
import { validateGroupTokens } from './validate-group-tokens';

export function resolveAlignment(
  output: AlignmentOutput,
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
    side: string,
  ): AlignmentSpan[] => {
    const spans: AlignmentSpan[] = [];
    let previousId = -2;
    const local = new Set<number>();
    for (const id of [...ids].sort((a, b) => a - b)) {
      const token = tokens[id];
      if (!token)
        throw new AlignmentValidationError(`Invalid ${side} token ID ${id}.`);
      if (local.has(id))
        throw new AlignmentValidationError(
          `Duplicate ${side} token ID ${id} within a group.`,
        );
      if (used.has(id))
        throw new AlignmentValidationError(
          `Overlapping ${side} token ID ${id} across groups.`,
        );
      local.add(id);
      used.add(id);
      const previous = spans.at(-1);
      if (previous && id === previousId + 1) previous.end = token.end;
      else spans.push({ start: token.start, end: token.end });
      previousId = id;
    }
    return spans;
  };
  return {
    version: 3,
    sourceText,
    translatedText,
    groups: output.groups.map((group, index) => {
      validateGroupTokens(group.source, group.sourceText, source, 'source');
      validateGroupTokens(
        group.translation,
        group.translationText,
        translation,
        'translation',
      );
      return {
        id: String(index),
        source: resolve(group.source, source, usedSource, 'source'),
        translation: resolve(
          group.translation,
          translation,
          usedTranslation,
          'translation',
        ),
      };
    }),
  };
}
