import { topScoringLanguage } from './top-scoring-language';

const cases: Array<[string, Record<string, number>, string]> = [
  ['ja', { ja: 0.63, en: 0.35 }, 'ja'],
  ['fr', { fr: 0.51, en: 0.49 }, 'fr'],
  ['en', { en: 0.15, fr: 0.14, unknown: 0.71 }, 'en'],
  ['en', { en: 0.2, fr: 0.8 }, 'fr'],
  ['fr', { en: 0.5, fr: 0.5 }, 'fr'],
  ['unknown', { unknown: 0.95, ja: 0.05 }, 'ja'],
  ['unsupported', { unsupported: 0.99, en: 0.01 }, 'en'],
];
it.each(cases)(
  'uses the top supported score for %s',
  (choice, probabilities, expected) => {
    expect(topScoringLanguage({ choice, probabilities })).toBe(expected);
  },
);

const unusable: Array<Record<string, number>> = [
  {},
  { en: 0 },
  { unknown: 1 },
  { unsupported: 1 },
];
it.each(unusable)(
  'reports unusable provider data instead of inventing a language',
  (probabilities) => {
    expect(() =>
      topScoringLanguage({ choice: 'unknown', probabilities }),
    ).toThrow('no supported language scores');
  },
);
