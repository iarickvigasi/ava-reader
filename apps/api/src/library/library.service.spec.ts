import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookFileFormat, BookFileKind } from '@prisma/client';
import { LibraryService } from './library.service';

describe('LibraryService', () => {
  const getCurrentUserRecord = jest.fn();
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const findFirstLibraryItem = jest.fn();
  const update = jest.fn();
  const deleteManyCollections = jest.fn();
  const prisma = {
    collection: {
      deleteMany: deleteManyCollections,
      findFirst,
      findMany,
      update,
    },
    libraryItem: {
      findFirst: findFirstLibraryItem,
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
    findMany.mockReset();
    update.mockReset();
    deleteManyCollections.mockReset();
    libraryService = new LibraryService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
  });

  it('returns only active collection books, ordered by engagement', async () => {
    findMany.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-a',
        items: [
          createCollectionItem({
            addedAt: '2026-04-01T10:00:00.000Z',
            author: 'First Author',
            completionPercent: 25,
            coverBytes: Buffer.from('cover-a'),
            id: 'library-a',
            lastReadAt: '2026-04-08T10:00:00.000Z',
            title: 'First Book',
          }),
          createCollectionItem({
            addedAt: '2026-04-03T10:00:00.000Z',
            author: 'Archived Author',
            completionPercent: 10,
            id: 'library-archived',
            isArchived: true,
            title: 'Archived Book',
          }),
          createCollectionItem({
            addedAt: '2026-04-02T10:00:00.000Z',
            author: 'Second Author',
            completionPercent: 100,
            id: 'library-b',
            lastOpenedAt: '2026-04-06T10:00:00.000Z',
            title: 'Second Book',
          }),
        ],
        name: 'Imported Books',
      }),
    ]);

    const payload = await libraryService.getLibrary('clerk_123');

    expect(getCurrentUserRecord).toHaveBeenCalledWith('clerk_123');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: true,
                    files: true,
                  },
                },
                progress: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    expect(payload.collections).toHaveLength(1);
    expect(payload.collections[0]).toMatchObject({
      id: 'collection-a',
      itemCount: 2,
      name: 'Imported Books',
      unreadCount: 1,
    });
    expect(
      payload.collections[0].books.map((book) => book.libraryItemId),
    ).toEqual(['library-a', 'library-b']);
    expect(payload.collections[0].books[0]).toMatchObject({
      author: 'First Author',
      completionPercent: 25,
      primaryFormat: BookFileFormat.EPUB,
      title: 'First Book',
    });
    expect(payload.collections[0].books[0].coverImageDataUrl).toBe(
      'data:image/png;base64,Y292ZXItYQ==',
    );
    expect(payload.collections[0].books[1].coverImageDataUrl).toBeNull();
  });

  it('limits library collection previews to the 4 most recent books', async () => {
    findMany.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-preview',
        items: [
          createCollectionItem({
            id: 'library-1',
            lastOpenedAt: '2026-04-10T10:00:00.000Z',
            title: 'Book 1',
          }),
          createCollectionItem({
            id: 'library-2',
            lastOpenedAt: '2026-04-09T10:00:00.000Z',
            title: 'Book 2',
          }),
          createCollectionItem({
            id: 'library-3',
            lastOpenedAt: '2026-04-08T10:00:00.000Z',
            title: 'Book 3',
          }),
          createCollectionItem({
            id: 'library-4',
            lastOpenedAt: '2026-04-07T10:00:00.000Z',
            title: 'Book 4',
          }),
          createCollectionItem({
            id: 'library-5',
            lastOpenedAt: '2026-04-06T10:00:00.000Z',
            title: 'Book 5',
          }),
        ],
        name: 'Preview Shelf',
      }),
    ]);

    const payload = await libraryService.getLibrary('clerk_123');

    expect(payload.collections[0]).toMatchObject({
      id: 'collection-preview',
      itemCount: 5,
      unreadCount: 5,
    });
    expect(
      payload.collections[0].books.map((book) => book.libraryItemId),
    ).toEqual(['library-1', 'library-2', 'library-3', 'library-4']);
  });

  it('keeps empty collections and serializes fallback timestamps safely', async () => {
    findMany.mockResolvedValue([
      createCollectionRecord({
        description: 'Your personal uploads.',
        id: 'collection-empty',
        items: [],
        name: 'Empty Shelf',
      }),
      createCollectionRecord({
        id: 'collection-filled',
        items: [
          createCollectionItem({
            addedAt: '2026-04-04T08:30:00.000Z',
            author: null,
            completionPercent: 0,
            id: 'library-c',
            title: 'Untitled Notes',
          }),
        ],
        name: 'Fresh Reads',
      }),
    ]);

    const payload = await libraryService.getLibrary('clerk_123');

    expect(payload.collections[0]).toMatchObject({
      description: 'Your personal uploads.',
      id: 'collection-empty',
      itemCount: 0,
      name: 'Empty Shelf',
      unreadCount: 0,
    });
    expect(payload.collections[0].books).toEqual([]);
    expect(payload.collections[1].books[0]).toMatchObject({
      author: null,
      lastReadAt: '2026-04-04T08:30:00.000Z',
      libraryItemId: 'library-c',
      title: 'Untitled Notes',
    });
  });

  it('treats a newer open as fresher engagement than an older lastReadAt', async () => {
    findMany.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-engagement',
        items: [
          createCollectionItem({
            addedAt: '2026-04-01T10:00:00.000Z',
            id: 'library-reopened',
            lastOpenedAt: '2026-04-10T09:00:00.000Z',
            lastReadAt: '2026-04-02T08:00:00.000Z',
            title: 'Reopened Book',
          }),
          createCollectionItem({
            addedAt: '2026-04-03T10:00:00.000Z',
            id: 'library-recent-read',
            lastReadAt: '2026-04-09T09:00:00.000Z',
            title: 'Recently Read Book',
          }),
        ],
      }),
    ]);

    const payload = await libraryService.getLibrary('clerk_123');

    expect(
      payload.collections[0].books.map((book) => book.libraryItemId),
    ).toEqual(['library-reopened', 'library-recent-read']);
    expect(payload.collections[0].books[0]?.lastReadAt).toBe(
      '2026-04-10T09:00:00.000Z',
    );
  });

  it('returns the full collection payload for one owned collection', async () => {
    findFirst.mockResolvedValue(
      createCollectionRecord({
        id: 'collection-1',
        name: 'Imported Books',
        items: [
          createCollectionItem({
            id: 'library-3',
            lastOpenedAt: '2026-04-10T10:00:00.000Z',
            title: 'Newest',
          }),
          createCollectionItem({
            id: 'library-2',
            lastOpenedAt: '2026-04-09T10:00:00.000Z',
            title: 'Middle',
          }),
          createCollectionItem({
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
        id: 'collection-1',
        userId: 'user-1',
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: true,
                    files: true,
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
      book: {
        author: 'Mary Shelley',
        coverBlob: {
          bytes: Buffer.from('cover-book'),
          mimeType: 'image/png',
        },
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
            sortOrder: 2,
          },
        },
        {
          collection: {
            id: 'collection-a',
            kind: 'SMART',
            name: 'Imported Books',
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
        id: 'library-42',
        isArchived: false,
        userId: 'user-1',
      },
      include: {
        book: {
          include: {
            coverBlob: true,
            files: true,
          },
        },
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                kind: true,
                name: true,
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
        approximatePageCount: 163,
        author: 'Mary Shelley',
        chapterLabel: 'Chapter 7',
        collections: [
          {
            id: 'collection-a',
            kind: 'SMART',
            name: 'Imported Books',
          },
          {
            id: 'collection-b',
            kind: 'CUSTOM',
            name: 'Night Reads',
          },
        ],
        completionPercent: 44,
        coverImageDataUrl: 'data:image/png;base64,Y292ZXItYm9vaw==',
        description: 'A gothic classic.',
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
        author: null,
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
    expect(payload.book.genres).toEqual([]);
  });

  it('renames one owned collection with a trimmed name', async () => {
    findFirst.mockResolvedValue({
      description: 'Old description',
      id: 'collection-1',
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

  it('deletes one owned collection, including non-empty collections', async () => {
    deleteManyCollections.mockResolvedValue({ count: 1 });

    const payload = await libraryService.deleteCollection(
      'clerk_123',
      'collection-filled',
    );

    expect(deleteManyCollections).toHaveBeenCalledWith({
      where: {
        id: 'collection-filled',
        userId: 'user-1',
      },
    });
    expect(payload).toEqual({
      collectionId: 'collection-filled',
      state: 'deleted',
    });
  });

  it('throws not found when deleting a missing or not-owned collection', async () => {
    deleteManyCollections.mockResolvedValue({ count: 0 });

    await expect(
      libraryService.deleteCollection('clerk_123', 'missing-collection'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      libraryService.deleteCollection('clerk_123', 'missing-collection'),
    ).rejects.toThrow('Collection not found.');
  });
});

function createCollectionRecord(
  overrides: Partial<{
    description: string | null;
    id: string;
    items: ReturnType<typeof createCollectionItem>[];
    kind: 'SMART' | 'CUSTOM';
    name: string;
    sortOrder: number;
  }> = {},
) {
  return {
    description: null,
    id: 'collection-1',
    items: [],
    kind: 'SMART',
    name: 'Collection',
    sortOrder: 0,
    ...overrides,
  };
}

function createCollectionItem(
  overrides: Partial<{
    addedAt: string;
    author: string | null;
    completionPercent: number;
    coverBytes: Buffer | null;
    id: string;
    isArchived: boolean;
    lastOpenedAt: string | null;
    lastReadAt: string | null;
    title: string;
  }> = {},
) {
  const {
    addedAt = '2026-04-01T00:00:00.000Z',
    author = 'Author',
    completionPercent = 0,
    coverBytes = null,
    id = 'library-item',
    isArchived = false,
    lastOpenedAt = null,
    lastReadAt = null,
    title = 'Book',
  } = overrides;

  return {
    libraryItem: {
      addedAt: new Date(addedAt),
      book: {
        author,
        coverBlob: coverBytes
          ? {
              bytes: coverBytes,
              mimeType: 'image/png',
            }
          : null,
        files: [
          {
            format: BookFileFormat.EPUB,
            isPrimary: true,
            kind: BookFileKind.SOURCE,
          },
        ],
        title,
      },
      id,
      isArchived,
      lastOpenedAt: lastOpenedAt ? new Date(lastOpenedAt) : null,
      progress: {
        completionPercent,
        lastReadAt: lastReadAt ? new Date(lastReadAt) : null,
      },
    },
  };
}
