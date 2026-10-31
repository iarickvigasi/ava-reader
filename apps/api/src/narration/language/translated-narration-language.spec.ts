import { translatedNarrationLanguage } from './translated-narration-language';

it.each([
  ['Рюноске Акутаґава', 'uk'],
  ['Это русская цитата', 'uk'],
  ['Ryunosuke Akutagawa', 'uk'],
  ['Ryunosuke Akutagawa', 'en'],
  ['François', 'en'],
  ['羅生門', 'ja'],
  ['羅生門', 'zh'],
  ['你好', 'ja'],
  ['سلام', 'ar'],
  ['नमस्कार', 'hi'],
])(
  'requires contextual identification for shared-script or preserved foreign text: %s (%s)',
  (text, translationLanguage) => {
    expect(
      translatedNarrationLanguage({ text, translationLanguage }),
    ).toBeNull();
  },
);

it.each([
  ['こんにちは', 'ja', 'ja'],
  ['안녕하세요', 'ko', 'ko'],
  ['สวัสดี', 'th', 'th'],
  ['こんにちは François', 'ja', null],
  ['bonjour', undefined, null],
  ['bonjour', 'unsupported', null],
  ['123', 'en', null],
])(
  'uses a known translation language only when every letter has its exclusive script: %s',
  (text, translationLanguage, expected) => {
    expect(translatedNarrationLanguage({ text, translationLanguage })).toBe(
      expected,
    );
  },
);
