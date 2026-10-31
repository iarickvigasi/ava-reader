import { UnprocessableEntityException } from '@nestjs/common';
import type { IpadicFeatures } from 'kuromoji';

// Okurigana makes a partial kanji reading recoverable; split compounds do not.
export function japaneseTokenReading(
  token: IpadicFeatures,
  start: number,
  end: number,
) {
  const reading = token.pronunciation || token.reading || token.surface_form;
  const from = token.word_position - 1;
  const before = token.surface_form.slice(0, Math.max(0, start - from));
  const after = token.surface_form.slice(Math.max(0, end - from));
  if (!before && !after) return reading;
  const kana = (value: string) =>
    value.replace(/[ぁ-ゖ]/g, (letter) =>
      String.fromCharCode(letter.charCodeAt(0) + 0x60),
    );
  const prefix = kana(before),
    suffix = kana(after);
  if (
    !/\p{Script=Han}/u.test(before + after) &&
    reading.startsWith(prefix) &&
    reading.endsWith(suffix)
  ) {
    return reading.slice(
      prefix.length,
      reading.length - suffix.length || undefined,
    );
  }
  throw new UnprocessableEntityException({
    code: 'NARRATION_LANGUAGE_UNCERTAIN',
    message: 'Select the whole Japanese word to resolve its reading.',
  });
}
