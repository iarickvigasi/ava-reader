import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLASSICS } from '../classics';
import { CLASSIC_LANGUAGES } from '../classic-seeds/types';
it('covers every current shortlist title without manufacturing publication approval', () => {
  for (const language of CLASSIC_LANGUAGES) {
    const file = resolve(
      __dirname,
      '../../../data/classics-rights',
      `${language}.json`,
    );
    const data = JSON.parse(readFileSync(file, 'utf8')) as {
      books: {
        id: string;
        title: string;
        author: string;
        language: string;
        authorGender: string;
        publication: null;
        publicationPolicy: string;
        originalTextResearch: {
          worldwideCleared: boolean;
          authorEvidenceUrl: string;
        };
      }[];
    };
    expect(data.books).toHaveLength(50);
    expect(new Set(data.books.map((book) => book.id)).size).toBe(50);
    expect(
      data.books.filter((book) => book.authorGender === 'woman'),
    ).toHaveLength(25);
    for (const seed of CLASSICS.filter((seed) => seed.language === language)) {
      const book = data.books.find(
        (book) => book.title === seed.title && book.author === seed.author,
      );
      expect(book?.language).toBe(language);
      expect(book?.publication).toBeNull();
      expect(book?.publicationPolicy).toBe('PUBLISH_WITH_REVIEW_DEFERRED');
      expect(book?.originalTextResearch.worldwideCleared).toBe(false);
      expect(book?.originalTextResearch.authorEvidenceUrl).toBe(
        seed.bibliographyUrl,
      );
    }
  }
});
