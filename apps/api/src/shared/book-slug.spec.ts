import { buildBookSlugBase, resolveUniqueBookSlug } from './book-slug';

describe('buildBookSlugBase', () => {
  it('combines title and first author with -by- separator', () => {
    expect(
      buildBookSlugBase({
        title: 'Invisible Women',
        authors: ['Caroline Criado Perez'],
      }),
    ).toBe('invisible-women-by-caroline-criado-perez');
  });

  it('transliterates cyrillic title and author', () => {
    expect(
      buildBookSlugBase({
        title: 'Війна і мир',
        authors: ['Лев Толстой'],
      }),
    ).toBe('viina-i-mir-by-lev-tolstoi');
  });

  it('handles diacritics in latin text', () => {
    expect(
      buildBookSlugBase({
        title: 'Café Society',
        authors: ['Niño Gómez'],
      }),
    ).toBe('cafe-society-by-nino-gomez');
  });

  it('falls back to title when no author is present', () => {
    expect(
      buildBookSlugBase({
        title: 'The Pragmatic Programmer',
        authors: [],
      }),
    ).toBe('the-pragmatic-programmer');
  });

  it('falls back to "untitled" when both fields are empty', () => {
    expect(buildBookSlugBase({ title: '', authors: [] })).toBe('untitled');
  });

  it('caps the slug length and trims a trailing hyphen', () => {
    const slug = buildBookSlugBase({
      title: 'A'.repeat(200),
      authors: ['B'.repeat(200)],
    });

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('resolveUniqueBookSlug', () => {
  it('returns the base when not taken', async () => {
    const slug = await resolveUniqueBookSlug('foo', () =>
      Promise.resolve(false),
    );
    expect(slug).toBe('foo');
  });

  it('appends -2 on first conflict, -3 on second, etc.', async () => {
    const taken = new Set(['foo', 'foo-2', 'foo-3']);
    const slug = await resolveUniqueBookSlug('foo', (candidate) =>
      Promise.resolve(taken.has(candidate)),
    );
    expect(slug).toBe('foo-4');
  });
});
