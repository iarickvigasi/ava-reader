import { readerCategories } from './reader-categories';
import { coverId } from './cover-id';

describe('source enrichment', () => {
  it('keeps unknown subjects unknown and does not classify nonfiction as fiction', () => {
    expect(readerCategories(['Non-fiction', 'unmapped subject'])).toEqual([
      'nonfiction',
    ]);
    expect(readerCategories([])).toEqual([]);
    expect(readerCategories(['Science fiction'])).toEqual(['fiction']);
  });
  it('recognizes overlapping forms and audiences without requiring authors', () => {
    expect(
      readerCategories([
        'Fantasy fiction',
        'Juvenile fiction',
        'Young adult',
        'Poetry',
      ]),
    ).toEqual(['fiction', 'fantasy', 'poetry', 'children', 'young-adult']);
  });
  it('ignores absent, negative, and nonnumeric cover IDs', () => {
    expect(coverId([-1, '12', 0, 123])).toBe(123);
    expect(coverId([])).toBeUndefined();
  });
});

describe('explicit reader category mappings', () => {
  it.each([
    'Fantasy fiction, history and criticism',
    'History and criticism',
    'Science fiction -- History and criticism',
    'Children in literature',
    'Philosophy in literature',
    'Biographical criticism',
    'Fictional characters',
    'Poetry criticism',
  ])(
    'does not infer categories from criticism or keyword mentions: %s',
    (label) => {
      expect(readerCategories([label])).toEqual([]);
    },
  );
  it('normalizes whitespace, fullwidth text and typographic apostrophes', () => {
    expect(
      readerCategories([
        '  ＦＡＮＴＡＳＹ   ＦＩＣＴＩＯＮ  ',
        'Children’s stories',
      ]),
    ).toEqual(['fiction', 'fantasy', 'children']);
  });
  it('uses supported complete multilingual labels and preserves unknowns', () => {
    expect(
      readerCategories(['поезія', 'literatura infantil', 'unmapped label']),
    ).toEqual(['poetry', 'children']);
    expect(readerCategories(['Nonfiction', 'Science fiction'])).toEqual([
      'fiction',
      'nonfiction',
    ]);
  });
});
