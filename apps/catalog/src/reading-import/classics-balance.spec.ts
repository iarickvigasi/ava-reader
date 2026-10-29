import { CLASSICS } from './classics';
import { CLASSIC_LANGUAGES } from './classic-seeds/types';

it('has equal distinct women and men authors in every seed language', () => {
  const expected = { uk: 4, en: 8, de: 8, fr: 7, es: 10, pl: 6 };
  for (const language of CLASSIC_LANGUAGES) {
    const authors = new Map(
      CLASSICS.filter((seed) => seed.language === language).map((seed) => [
        seed.author,
        seed.authorGender,
      ]),
    );
    expect(
      [...authors.values()].filter((gender) => gender === 'woman'),
    ).toHaveLength(expected[language]);
    expect(
      [...authors.values()].filter((gender) => gender === 'man'),
    ).toHaveLength(expected[language]);
  }
});

it('counts women writing under male pen names as women and preserves their catalog aliases', () => {
  for (const penName of [
    'Марко Вовчок',
    'George Eliot',
    'George Sand',
    'Fernán Caballero',
  ]) {
    const seed = CLASSICS.find((classic) =>
      classic.authorAliases.includes(penName),
    );
    expect(seed?.authorGender).toBe('woman');
  }
});

it('keeps four Ukrainian women and 25 original-language works', () => {
  const women = CLASSICS.filter(
    (seed) => seed.language === 'uk' && seed.authorGender === 'woman',
  );
  expect(women).toHaveLength(25);
  expect(new Set(women.map((seed) => seed.author)).size).toBe(4);
  expect(women.map((seed) => seed.title)).toContain('Лісова пісня');
});

it('offers works by both women and men early in every language inventory', () => {
  for (const language of CLASSIC_LANGUAGES) {
    const first = CLASSICS.filter((seed) => seed.language === language).slice(
      0,
      2,
    );
    expect(new Set(first.map((seed) => seed.authorGender)).size).toBe(2);
  }
});

it('offers 25 works by women and 25 by men in every language', () => {
  for (const language of CLASSIC_LANGUAGES) {
    for (const gender of ['woman', 'man']) {
      expect(
        CLASSICS.filter(
          (seed) => seed.language === language && seed.authorGender === gender,
        ),
      ).toHaveLength(25);
    }
  }
});
