import { translatedNarrationLanguage } from './translated-narration-language';

it.each([
  ['Рюноске Акутаґава', 'uk', 'uk'],
  ['Ryunosuke Akutagawa', 'uk', null],
  ['Ryunosuke Akutagawa', 'en', null],
  ['François', 'en', null],
  ['羅生門', 'ja', 'ja'],
  ['羅生門', 'zh', 'zh'],
  ['bonjour', undefined, null],
  ['bonjour', 'unsupported', null],
  ['123', 'en', null],
])(
  'uses known translation language only when supported and script agrees: %s',
  (text, translationLanguage, expected) => {
    expect(translatedNarrationLanguage({ text, translationLanguage })).toBe(
      expected,
    );
  },
);
