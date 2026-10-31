import { UnprocessableEntityException } from '@nestjs/common';
import { japaneseTokenReading } from './japanese-token-reading';
import { dirname, join } from 'node:path';
import { builder, type IpadicFeatures, type Tokenizer } from 'kuromoji';

let dictionary: Promise<Tokenizer<IpadicFeatures>> | undefined;

// Load the bundled Japanese dictionary once; no network call or book-specific overrides.
export async function japanesePronunciation(
  text: string,
  context?: string,
  contextOffset?: number,
) {
  if (!/\p{Script=Han}/u.test(text)) return text;
  if (/[\u{10000}-\u{10ffff}]/u.test(text)) throw ambiguousReading();
  const tokenizer = await loadDictionary();
  const starts = context ? matchingStarts(context, text, contextOffset) : [];
  if (context && starts.length) {
    // Kuromoji mishandles surrogate pairs and their following token offsets.
    // Two BMP boundaries preserve UTF-16 length without dropping subsequent kana/kanji.
    const tokens = tokenizer.tokenize(
      context.replace(/[\u{10000}-\u{10ffff}]/gu, '。。'),
    );
    const readings = starts.map((start) =>
      tokens
        .filter((token) => {
          const from = token.word_position - 1;
          return (
            from < start + text.length &&
            from + token.surface_form.length > start
          );
        })
        .map((token) => japaneseTokenReading(token, start, start + text.length))
        .join(''),
    );
    if (new Set(readings).size !== 1) throw ambiguousReading();
    return readings[0];
  }
  return tokenizer
    .tokenize(text)
    .map((token) => token.pronunciation || token.reading || token.surface_form)
    .join('');
}

function ambiguousReading() {
  return new UnprocessableEntityException({
    code: 'NARRATION_LANGUAGE_UNCERTAIN',
    message: 'Select the whole Japanese word to resolve its reading.',
  });
}

function matchingStarts(context: string, text: string, offset?: number) {
  if (
    offset !== undefined &&
    Number.isInteger(offset) &&
    offset >= 0 &&
    context.slice(offset, offset + text.length) === text
  )
    return [offset];
  const starts: number[] = [];
  for (
    let from = context.indexOf(text);
    from >= 0;
    from = context.indexOf(text, from + 1)
  )
    starts.push(from);
  return starts;
}

function loadDictionary() {
  dictionary ??= new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
    builder({
      dicPath: join(dirname(require.resolve('kuromoji/package.json')), 'dict'),
    }).build((error, tokenizer) =>
      error ? reject(error) : resolve(tokenizer),
    );
  }).catch((error: unknown) => {
    dictionary = undefined;
    throw error;
  });
  return dictionary;
}
