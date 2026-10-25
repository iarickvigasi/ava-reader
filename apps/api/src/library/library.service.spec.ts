import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookFileFormat, BookFileKind } from '@prisma/client';
import { LibraryService } from './library.service';

describe('LibraryService', () => {
  const getCurrentUserRecord = jest.fn();
  const findManyCollections = jest.fn();
  const findManyLibraryItems = jest.fn();
  const findFirst = jest.fn();
  const findFirstLibraryItem = jest.fn();
  const updateLibraryItem = jest.fn();
  const update = jest.fn();
  const deleteCollection = jest.fn();
  const findUniqueCollection = jest.fn();
  const upsertCollectionItem = jest.fn();
  const deleteManyCollectionItems = jest.fn();
  // Interactive transactions run against the same mock surface, so the tests
  // assert on the calls exactly as they would outside one. Annotated rather
  // than inferred: inlining it would make `prisma`'s type reference itself.
  const runInTransaction = <T>(run: (tx: unknown) => T): T => run(prisma);
  const prisma = {
    $transaction: runInTransaction,
    collection: {
      delete: deleteCollection,
      findFirst,
      findMany: findManyCollections,
      findUnique: findUniqueCollection,
      update,
    },
    collectionItem: {
      deleteMany: deleteManyCollectionItems,
      upsert: upsertCollectionItem,
    },
    libraryItem: {
      findFirst: findFirstLibraryItem,
      findMany: findManyLibraryItems,
      update: updateLibraryItem,
    },
  };
  const usersService = {
    getCurrentUserRecord,
  };
  let libraryService: LibraryService;
  beforeEach(() => {
    getCurrentUserRecord.mockReset();
    findFirst.mockReset();
    findFirstLibraryItem.mockReset();
    updateLibraryItem.mockReset();
    findManyCollections.mockReset();
    findManyLibraryItems.mockReset();
    update.mockReset();
    deleteCollection.mockReset();
    findUniqueCollection.mockReset();
    upsertCollectionItem.mockReset();
    deleteManyCollectionItems.mockReset();
    libraryService = new LibraryService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
  });

  it('returns the full collection payload for one owned collection', async () => {
    findFirst.mockResolvedValue(
      createFullCollectionRecord({
        id: 'collection-1',
        name: 'Imported Books',
        items: [
          createFullCollectionItem({
            id: 'library-3',
            lastOpenedAt: '2026-04-10T10:00:00.000Z',
            title: 'Newest',
          }),
          createFullCollectionItem({
            id: 'library-2',
            lastOpenedAt: '2026-04-09T10:00:00.000Z',
            title: 'Middle',
          }),
          createFullCollectionItem({
            id: 'library-1',
            lastOpenedAt: '2026-04-08T10:00:00.000Z',
            title: 'Oldest',
          }),
        ],
      }),
    );

    const payload = await libraryService.getCollection(
      'clerk_123',
      'collection-1',
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        OR: [{ id: 'collection-1' }, { slug: 'collection-1' }],
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: { select: { mimeType: true } },
                    files: {
                      select: { format: true, isPrimary: true, kind: true },
                    },
                  },
                },
                progress: true,
              },
            },
          },
        },
      },
    });
    expect(payload.collection.books.map((book) => book.libraryItemId)).toEqual([
      'library-3',
      'library-2',
      'library-1',
    ]);
    expect(payload.collection.itemCount).toBe(3);
  });

  it('emits cover image urls for books that have a cover blob', async () => {
    findFirst.mockResolvedValue(
      createFullCollectionRecord({
        id: 'collection-covers',
        items: [
          createFullCollectionItem({
            bookId: 'book-with-cover',
            hasCover: true,
            id: 'library-with',
            title: 'With Cover',
          }),
          createFullCollectionItem({
            bookId: 'book-no-cover',
            hasCover: false,
            id: 'library-without',
            title: 'Without Cover',
          }),
        ],
      }),
    );

    const payload = await libraryService.getCollection(
      'clerk_123',
      'collection-covers',
    );

    const byId = new Map(
      payload.collection.books.map((book) => [book.libraryItemId, book]),
    );
    expect(byId.get('library-with')?.coverImageUrl).toBe(
      '/api/library/covers/book-with-cover',
    );
    expect(byId.get('library-without')?.coverImageUrl).toBeNull();
  });

  it('throws not found when requesting a missing collection', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      libraryService.getCollection('clerk_123', 'missing-collection'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      libraryService.getCollection('clerk_123', 'missing-collection'),
    ).rejects.toThrow('Collection not found.');
  });

  it('returns one library item payload with approximate page count when available', async () => {
    findFirstLibraryItem.mockResolvedValue({
      addedAt: new Date('2026-04-01T10:00:00.000Z'),
      finishedAt: new Date('2026-09-13T10:00:00.000Z'),
      book: {
        authors: ['Mary Shelley'],
        coverBlob: { mimeType: 'image/png' },
        description: 'A gothic classic.',
        estimatedPageCount: 163,
        files: [
          {
            format: BookFileFormat.EPUB,
            isPrimary: true,
            kind: BookFileKind.SOURCE,
          },
        ],
        genres: ['Gothic', 'Horror'],
        id: 'book-frank',
        language: 'English',
        publishedYear: 1818,
        title: 'Frankenstein',
      },
      collectionItems: [
        {
          collection: {
            id: 'collection-b',
            kind: 'CUSTOM',
            name: 'Night Reads',
            smartKey: null,
            sortOrder: 2,
          },
        },
        {
          collection: {
            id: 'collection-a',
            kind: 'SMART',
            name: 'Imported Books',
            smartKey: 'imported',
            sortOrder: 1,
          },
        },
      ],
      id: 'library-42',
      isArchived: false,
      progress: {
        chapterLabel: 'Chapter 7',
        completionPercent: 44,
        lastReadAt: new Date('2026-04-11T08:30:00.000Z'),
        minutesRead: 195,
      },
      source: 'IMPORTED',
      userId: 'user-1',
    });

    const payload = await libraryService.getLibraryItem(
      'clerk_123',
      'library-42',
    );

    expect(findFirstLibraryItem).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isArchived: false,
        OR: [{ id: 'library-42' }, { slug: 'library-42' }],
      },
      include: {
        book: {
          include: {
            coverBlob: { select: { mimeType: true } },
            files: {
              select: { format: true, isPrimary: true, kind: true },
            },
          },
        },
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                kind: true,
                name: true,
                smartKey: true,
                sortOrder: true,
              },
            },
          },
        },
        progress: true,
      },
    });
    expect(payload).toEqual({
      book: {
        addedAt: '2026-04-01T10:00:00.000Z',
        // Null until the chapter-purpose analysis runs for this book.
        approximateBodyPageCount: null,
        approximatePageCount: 163,
        authors: ['Mary Shelley'],
        chapterLabel: 'Chapter 7',
        collections: [
          {
            id: 'collection-a',
            kind: 'SMART',
            name: 'Imported Books',
            smartKey: 'imported',
          },
          {
            id: 'collection-b',
            kind: 'CUSTOM',
            name: 'Night Reads',
            smartKey: null,
          },
        ],
        completionPercent: 44,
        coverImageUrl: '/api/library/covers/book-frank',
        description: 'A gothic classic.',
        finishedAt: '2026-09-13T10:00:00.000Z',
        genres: ['Gothic', 'Horror'],
        language: 'English',
        lastReadAt: '2026-04-11T08:30:00.000Z',
        libraryItemId: 'library-42',
        minutesRead: 195,
        primaryFormat: BookFileFormat.EPUB,
        publishedYear: 1818,
        source: 'IMPORTED',
        title: 'Frankenstein',
      },
    });
  });

  it('returns null approximate page count when no estimate is available', async () => {
    findFirstLibraryItem.mockResolvedValue({
      addedAt: new Date('2026-04-03T10:00:00.000Z'),
      book: {
        authors: [],
        coverBlob: null,
        description: null,
        estimatedPageCount: null,
        files: [
          {
            format: BookFileFormat.PDF,
            isPrimary: true,
            kind: BookFileKind.SOURCE,
          },
        ],
        genres: [],
        id: 'book-unknown',
        language: null,
        publishedYear: null,
        title: 'Unknown Treatise',
      },
      collectionItems: [],
      id: 'library-unknown',
      isArchived: false,
      progress: null,
      source: 'CATALOG',
      userId: 'user-1',
    });

    const payload = await libraryService.getLibraryItem(
      'clerk_123',
      'library-unknown',
    );

    expect(payload.book.approximatePageCount).toBeNull();
    expect(payload.book.finishedAt).toBeNull();
    expect(payload.book.genres).toEqual([]);
    expect(payload.book.coverImageUrl).toBeNull();
  });

  it("sets a finish date on the current user's library item", async () => {
    const finishedAt = new Date('2026-09-13T10:00:00.000Z');
    findFirstLibraryItem.mockResolvedValue({ id: 'library-42' });
    updateLibraryItem.mockResolvedValue({ id: 'library-42', finishedAt });

    await expect(
      libraryService.setFinishedAt('clerk_123', 'library-42', {
        finishedAt: finishedAt.toISOString(),
      }),
    ).resolves.toEqual({
      libraryItemId: 'library-42',
      finishedAt: finishedAt.toISOString(),
    });
    expect(getCurrentUserRecord).toHaveBeenCalledWith('clerk_123');
    expect(updateLibraryItem).toHaveBeenCalledWith({
      where: { id: 'library-42', userId: 'user-1', isArchived: false },
      data: { finishedAt },
      select: { id: true, finishedAt: true },
    });
  });

  it('renames one owned collection with a trimmed name', async () => {
    findFirst.mockResolvedValue({
      description: 'Old description',
      id: 'collection-1',
      kind: 'CUSTOM',
    });
    update.mockResolvedValue({
      description: 'Updated description',
      id: 'collection-1',
      name: 'Updated Shelf',
    });

    const payload = await libraryService.renameCollection(
      'clerk_123',
      'collection-1',
      {
        description: '  Updated description  ',
        name: '  Updated Shelf  ',
      },
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'collection-1',
        userId: 'user-1',
      },
      select: {
        description: true,
        id: true,
        kind: true,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'collection-1',
      },
      data: {
        description: 'Updated description',
        name: 'Updated Shelf',
      },
      select: {
        description: true,
        id: true,
        name: true,
      },
    });
    expect(payload).toEqual({
      collectionId: 'collection-1',
      description: 'Updated description',
      name: 'Updated Shelf',
    });
  });

  it('rejects renaming with an empty collection name', async () => {
    await expect(
      libraryService.renameCollection('clerk_123', 'collection-1', {
        description: 'Any description',
        name: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      libraryService.renameCollection('clerk_123', 'collection-1', {
        description: 'Any description',
        name: '   ',
      }),
    ).rejects.toThrow('Collection name is required.');
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects renaming to a duplicate collection name', async () => {
    findFirst.mockResolvedValue({
      description: null,
      id: 'collection-1',
      kind: 'CUSTOM',
    });
    update.mockRejectedValue({ code: 'P2002' });

    await expect(
      libraryService.renameCollection('clerk_123', 'collection-1', {
        description: 'desc',
        name: 'Already Used',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      libraryService.renameCollection('clerk_123', 'collection-1', {
        description: 'desc',
        name: 'Already Used',
      }),
    ).rejects.toThrow('A collection with this name already exists.');
  });

  it('throws not found when renaming a missing or not-owned collection', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      libraryService.renameCollection('clerk_123', 'missing-collection', {
        description: 'desc',
        name: 'Next Name',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      libraryService.renameCollection('clerk_123', 'missing-collection', {
        description: 'desc',
        name: 'Next Name',
      }),
    ).rejects.toThrow('Collection not found.');
    expect(update).not.toHaveBeenCalled();
  });

  it('normalizes blank description to null when renaming', async () => {
    findFirst.mockResolvedValue({
      description: 'Existing description',
      id: 'collection-1',
      kind: 'CUSTOM',
    });
    update.mockResolvedValue({
      description: null,
      id: 'collection-1',
      name: 'Updated Name',
    });

    const payload = await libraryService.renameCollection(
      'clerk_123',
      'collection-1',
      {
        description: '   ',
        name: 'Updated Name',
      },
    );

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'collection-1',
      },
      data: {
        description: null,
        name: 'Updated Name',
      },
      select: {
        description: true,
        id: true,
        name: true,
      },
    });
    expect(payload).toEqual({
      collectionId: 'collection-1',
      description: null,
      name: 'Updated Name',
    });
  });

  it('rejects renaming a smart collection', async () => {
    findFirst.mockResolvedValue({
      description: 'Auto-generated collection.',
      id: 'smart-collection-1',
      kind: 'SMART',
    });

    await expect(
      libraryService.renameCollection('clerk_123', 'smart-collection-1', {
        description: 'New desc',
        name: 'New Name',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      libraryService.renameCollection('clerk_123', 'smart-collection-1', {
        description: 'New desc',
        name: 'New Name',
      }),
    ).rejects.toThrow('Smart collections cannot be renamed.');
    expect(update).not.toHaveBeenCalled();
  });

  it('deletes one owned collection, including non-empty collections', async () => {
    findFirst.mockResolvedValue({ id: 'collection-filled', kind: 'CUSTOM' });
    deleteCollection.mockResolvedValue({ id: 'collection-filled' });

    const payload = await libraryService.deleteCollection(
      'clerk_123',
      'collection-filled',
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'collection-filled',
        userId: 'user-1',
      },
      select: { id: true, kind: true },
    });
    expect(deleteCollection).toHaveBeenCalledWith({
      where: { id: 'collection-filled' },
    });
    expect(payload).toEqual({
      collectionId: 'collection-filled',
      state: 'deleted',
    });
  });

  it('throws not found when deleting a missing or not-owned collection', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      libraryService.deleteCollection('clerk_123', 'missing-collection'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      libraryService.deleteCollection('clerk_123', 'missing-collection'),
    ).rejects.toThrow('Collection not found.');
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it('rejects deleting a smart collection', async () => {
    findFirst.mockResolvedValue({ id: 'smart-collection-1', kind: 'SMART' });

    await expect(
      libraryService.deleteCollection('clerk_123', 'smart-collection-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      libraryService.deleteCollection('clerk_123', 'smart-collection-1'),
    ).rejects.toThrow('Smart collections cannot be deleted.');
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it('sets the offline-requested intent and stamps the timestamp', async () => {
    findFirstLibraryItem.mockResolvedValue({ id: 'item-1' });
    updateLibraryItem.mockResolvedValue({
      id: 'item-1',
      slug: 'a-book',
      offlineRequested: true,
    });

    const payload = await libraryService.setOfflineRequested(
      'clerk_123',
      'item-1',
      true,
    );

    expect(findFirstLibraryItem).toHaveBeenCalledWith({
      where: { id: 'item-1', isArchived: false, userId: 'user-1' },
      select: { id: true },
    });
    expect(updateLibraryItem).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { offlineRequested: true },
      select: { id: true, slug: true, offlineRequested: true },
    });
    expect(payload).toEqual({
      libraryItemId: 'item-1',
      offlineRequested: true,
      slug: 'a-book',
    });
  });

  it('clears the offline-requested timestamp when unsetting', async () => {
    findFirstLibraryItem.mockResolvedValue({ id: 'item-1' });
    updateLibraryItem.mockResolvedValue({
      id: 'item-1',
      slug: 'a-book',
      offlineRequested: false,
    });

    await libraryService.setOfflineRequested('clerk_123', 'item-1', false);

    expect(updateLibraryItem).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { offlineRequested: false },
      select: { id: true, slug: true, offlineRequested: true },
    });
  });

  it('skips membership when the user has no Offline Books shelf yet', async () => {
    findFirstLibraryItem.mockResolvedValue({ id: 'item-1' });
    updateLibraryItem.mockResolvedValue({
      id: 'item-1',
      slug: 'a-book',
      offlineRequested: true,
    });
    findUniqueCollection.mockResolvedValue(null);

    await libraryService.setOfflineRequested('clerk_123', 'item-1', true);

    expect(upsertCollectionItem).not.toHaveBeenCalled();
    expect(deleteManyCollectionItems).not.toHaveBeenCalled();
  });

  it('throws not found when toggling offline on a missing item', async () => {
    findFirstLibraryItem.mockResolvedValue(null);

    await expect(
      libraryService.setOfflineRequested('clerk_123', 'missing', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateLibraryItem).not.toHaveBeenCalled();
  });
});

function createFullCollectionRecord(
  overrides: Partial<{
    description: string | null;
    id: string;
    items: ReturnType<typeof createFullCollectionItem>[];
    kind: 'SMART' | 'CUSTOM';
    name: string;
    slug: string;
    sortOrder: number;
  }> = {},
) {
  const id = overrides.id ?? 'collection-1';

  return {
    description: null,
    id,
    items: [],
    kind: 'SMART',
    name: 'Collection',
    slug: overrides.slug ?? id,
    smartKey: null,
    sortOrder: 0,
    ...overrides,
  };
}

function createFullCollectionItem(
  overrides: Partial<{
    addedAt: string;
    authors: string[];
    bookId: string;
    completionPercent: number;
    hasCover: boolean;
    id: string;
    isArchived: boolean;
    lastOpenedAt: string | null;
    lastReadAt: string | null;
    slug: string;
    title: string;
  }> = {},
) {
  const {
    addedAt = '2026-04-01T00:00:00.000Z',
    authors = ['Author'],
    bookId = `book-${overrides.id ?? 'library-item'}`,
    completionPercent = 0,
    hasCover = false,
    id = 'library-item',
    isArchived = false,
    lastOpenedAt = null,
    lastReadAt = null,
    slug,
    title = 'Book',
  } = overrides;

  return {
    libraryItem: {
      addedAt: new Date(addedAt),
      book: {
        authors,
        coverBlob: hasCover ? { mimeType: 'image/png' } : null,
        files: [
          {
            format: BookFileFormat.EPUB,
            isPrimary: true,
            kind: BookFileKind.SOURCE,
          },
        ],
        id: bookId,
        title,
      },
      id,
      isArchived,
      lastOpenedAt: lastOpenedAt ? new Date(lastOpenedAt) : null,
      progress: {
        completionPercent,
        lastReadAt: lastReadAt ? new Date(lastReadAt) : null,
      },
      slug: slug ?? id,
    },
  };
}
