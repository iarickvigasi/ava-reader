import type { PrismaService } from '../../prisma/prisma.service';
import { libraryCoverUrl } from './library-cover-url';
import { getPublicBookCover } from './get-public-book-cover';
import { serializeLibraryBook } from '../serialize-library-book';
const book = {
  id: 'book',
  coverBlob: { mimeType: 'image/png' },
  canonicalImportPrivate: true,
};
it('serializes an owned finite cover route in a library card', () => {
  expect(libraryCoverUrl(book, 'library')).toBe(
    '/api/library/epub-imports/covers/library',
  );
  const card = serializeLibraryBook(
    {
      id: 'library',
      slug: 'book',
      finishedAt: null,
      offlineRequested: false,
      book: { ...book, authors: [], title: 'Book', files: [] },
    },
    { completionPercent: 0, lastReadAt: new Date(0) },
  );
  expect(card.coverImageUrl).toBe('/api/library/epub-imports/covers/library');
});
it('preserves ordinary EPUB/public and PDF cover behavior', () => {
  expect(
    libraryCoverUrl({ ...book, canonicalImportPrivate: false }, 'library'),
  ).toBe('/api/library/covers/book');
  expect(
    libraryCoverUrl({ ...book, pdfImport: { id: 'operation' } }, 'library'),
  ).toBeNull();
  expect(libraryCoverUrl({ ...book, coverBlob: null }, 'library')).toBeNull();
});
it('never serves the private EPUB cover through the public route', async () => {
  const prisma = {
    book: { findUnique: jest.fn().mockResolvedValue(book) },
  } as unknown as PrismaService;
  expect(await getPublicBookCover(prisma, 'book')).toBeNull();
});
