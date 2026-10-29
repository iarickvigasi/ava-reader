import { CLASSICS } from './classics';
import { CLASSIC_LANGUAGES } from './classic-seeds/types';
import { classicTitleVariants } from './classic-title-variants';

it('keeps 50 distinct works in each of the six languages', () => {
  const counts = Object.fromEntries(
    CLASSIC_LANGUAGES.map((language) => [
      language,
      CLASSICS.filter((seed) => seed.language === language).length,
    ]),
  );
  expect(counts).toEqual({ uk: 50, en: 50, de: 50, fr: 50, es: 50, pl: 50 });
  expect(
    new Set(
      CLASSICS.map((seed) => `${seed.language}:${seed.title}:${seed.author}`),
    ).size,
  ).toBe(CLASSICS.length);
  expect(
    CLASSICS.some((seed) => /Tolst|Dost|Doyle|Толст|Досто/.test(seed.author)),
  ).toBe(false);
});

it('records full names and traceable evidence for the conservative original-text screen', () => {
  for (const seed of CLASSICS) {
    expect(seed.author.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
    expect(seed.authorDeathYear).toBeLessThanOrEqual(1925);
    expect(seed.authorDeathYear).toBeGreaterThan(1500);
    expect(seed.bibliographyUrl).toMatch(
      /^https:\/\/([a-z]{2}\.wikisource\.org\/wiki\/|wolnelektury\.pl\/katalog\/autor\/)/,
    );
    expect(seed.authorAliases.length).toBeGreaterThan(0);
  }
});

it('offers every language before a bounded inventory can exhaust its first language', () => {
  expect(CLASSICS.slice(0, 6).map((seed) => seed.language)).toEqual(
    CLASSIC_LANGUAGES,
  );
});

it('matches native titles and catalog punctuation without counting aliases as more books', () => {
  const alice = CLASSICS.find((seed) => seed.author.includes('Dodgson'))!;
  expect(classicTitleVariants(alice)).toContain(
    "Alice's Adventures in Wonderland",
  );
  const eneida = CLASSICS.find((seed) => seed.title === 'Енеїда')!;
  expect(classicTitleVariants(eneida)).toEqual(['Енеїда', 'Eneida']);
  expect(
    CLASSICS.filter((seed) => seed.author === 'Herman Melville'),
  ).toHaveLength(3);
});
