import { createSentenceSegmenter } from './create-sentence-segmenter';

describe('source sentence locale', () => {
  it.each([
    ['uk', 'uk'],
    [' ja ', 'ja'],
    ['pt_BR', 'pt-BR'],
    ['zh-Hant', 'zh-Hant'],
  ])('uses the normalized source language %s', (language, locale) => {
    expect(createSentenceSegmenter(language).resolvedOptions()).toMatchObject({
      locale,
      granularity: 'sentence',
    });
  });

  it.each([null, '', '   ', 'not a locale', 'zz', 'English'])(
    'uses a deterministic fallback for unusable metadata %s',
    (language) => {
      expect(createSentenceSegmenter(language).resolvedOptions().locale).toBe(
        'en',
      );
    },
  );
});
