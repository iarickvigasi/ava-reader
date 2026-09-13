import { loadHomeCatalog } from './load-home-catalog';

describe('loadHomeCatalog serialization', () => {
  const book = {
    authors: ['Example Author'],
    coverBlob: { mimeType: 'image/jpeg' },
    description: 'Book description',
    files: [
      { format: 'READER_PACKAGE', isPrimary: true, kind: 'DERIVED_READER' },
      { format: 'PDF', isPrimary: false, kind: 'SOURCE' },
      { format: 'EPUB', isPrimary: true, kind: 'SOURCE' },
    ],
    id: 'book-1',
    title: 'Book title',
  };

  it('uses editorial metadata and prefers the primary source file', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        book,
        editorialDescription: 'Editorial description',
        editorialTitle: 'Editorial title',
        id: 'catalog-1',
        isFeatured: true,
      },
    ]);

    const entries = await loadHomeCatalog({
      catalogEntry: { findMany },
    } as never);

    expect(entries).toEqual([
      {
        authors: ['Example Author'],
        coverImageUrl: '/api/library/covers/book-1',
        description: 'Editorial description',
        id: 'catalog-1',
        isFeatured: true,
        primaryFormat: 'EPUB',
        title: 'Editorial title',
      },
    ]);
  });

  it.each([
    [null, 'Book title', 'Book description'],
    ['', '', ''],
  ])(
    'falls back only for null editorial metadata (%s)',
    async (value, title, description) => {
      const findMany = jest.fn().mockResolvedValue([
        {
          book: { ...book, coverBlob: null, files: [] },
          editorialDescription: value,
          editorialTitle: value,
          id: 'catalog-1',
          isFeatured: false,
        },
      ]);

      const entries = await loadHomeCatalog({
        catalogEntry: { findMany },
      } as never);

      expect(entries[0]).toMatchObject({
        coverImageUrl: null,
        description,
        primaryFormat: 'UNKNOWN',
        title,
      });
    },
  );
});
