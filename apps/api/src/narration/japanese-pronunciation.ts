import { japaneseTokenReading } from './japanese-token-reading';
import { dirname, join } from 'node:path';
import { builder, type IpadicFeatures, type Tokenizer } from 'kuromoji';

let dictionary: Promise<Tokenizer<IpadicFeatures>> | undefined;

// Load the bundled Japanese dictionary once; no network call or book-specific overrides.
export async function japanesePronunciation(text: string, context?: string) {
  if (!/\p{Script=Han}/u.test(text)) return text;
  const tokenizer = await loadDictionary();
  const start = context?.indexOf(text) ?? -1;
  if (start >= 0 && context) {
    return tokenizer
      .tokenize(context)
      .filter((token) => {
        const from = token.word_position - 1;
        return (
          from < start + text.length && from + token.surface_form.length > start
        );
      })
      .map((token) => japaneseTokenReading(token, start, start + text.length))
      .join('');
  }
  return tokenizer
    .tokenize(text)
    .map((token) => token.pronunciation || token.reading || token.surface_form)
    .join('');
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
