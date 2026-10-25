import { BookFileFormat, BookFileKind, LibrarySource } from '@prisma/client';
import { addBookToUserLibraryTx } from './add-book-to-user-library';

it.each([LibrarySource.IMPORTED, LibrarySource.CATALOG])(
  'adds %s books without creating any default collection',
  async (source) => {
    const item = {
      id: 'item',
      slug: 'book',
      addedAt: new Date(),
      progress: {},
      book: {
        id: 'book',
        title: 'Book',
        authors: [],
        files: [
          {
            format: BookFileFormat.EPUB,
            kind: BookFileKind.SOURCE,
            isPrimary: true,
          },
        ],
      },
    };
    const tx = {
      libraryItem: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(item),
      },
      book: { findUniqueOrThrow: jest.fn().mockResolvedValue(item.book) },
      collection: { upsert: jest.fn() },
      collectionItem: { upsert: jest.fn() },
    };
    const result = await addBookToUserLibraryTx(tx as never, {
      source,
      bookId: 'book',
      userId: 'owner',
    });
    expect(result).toMatchObject({
      libraryItemId: 'item',
      state: 'added',
      source,
    });
    expect(tx.collection.upsert).not.toHaveBeenCalled();
    expect(tx.collectionItem.upsert).not.toHaveBeenCalled();
  },
);
