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
  const deleteManyCollections = jest.fn();
  const prisma = {
    collection: {
      deleteMany: deleteManyCollections,
      findFirst,
      findMany: findManyCollections,
      update,
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
  const previewBooksById: Record<
    string,
    ReturnType<typeof createPreviewBook>
  > = {};
  function registerPreviewBook(book: ReturnType<typeof createPreviewBook>) {
    previewBooksById[book.id] = book;
    return book;
  }

  beforeEach(() => {
    getCurrentUserRecord.mockReset();
    findFirst.mockReset();
    findFirstLibraryItem.mockReset();
    updateLibraryItem.mockReset();
    findManyCollections.mockReset();
    findManyLibraryItems.mockReset();
    update.mockReset();
    deleteManyCollections.mockReset();
    for (const key of Object.keys(previewBooksById)) {
      delete previewBooksById[key];
    }
    libraryService = new LibraryService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
    findManyLibraryItems.mockImplementation(
      ({
        where: {
          id: { in: ids },
        },
      }: {
        where: { id: { in: string[] } };
      }) =>
        Promise.resolve(ids.map((id) => previewBooksById[id]).filter(Boolean)),
    );
  });

  it('returns only active collection books, ordered by engagement', async () => {
    registerPreviewBook(
      createPreviewBook({
        authors: ['First Author'],
        bookId: 'book-a',
        hasCover: true,
        id: 'library-a',
        title: 'First Book',
      }),
    );
    registerPreviewBook(
      createPreviewBook({
        authors: ['Second Author'],
        bookId: 'book-b',
        hasCover: false,
        id: 'library-b',
        title: 'Second Book',
      }),
    );
    findManyCollections.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-a',
        items: [
          createLightweightItem({
            addedAt: '2026-04-01T10:00:00.000Z',
            completionPercent: 25,
            id: 'library-a',
            lastReadAt: '2026-04-08T10:00:00.000Z',
          }),
          createLightweightItem({
            addedAt: '2026-04-03T10:00:00.000Z',
            completionPercent: 10,
            id: 'library-archived',
            isArchived: true,
          }),
          createLightweightItem({
            addedAt: '2026-04-02T10:00:00.000Z',
            completionPercent: 100,
            id: 'library-b',
            lastOpenedAt: '2026-04-06T10:00:00.000Z',
          }),
        ],
        name: 'Imported Books',
      }),
    ]);

    const payload = await libraryService.getLibrary('clerk_123');

    expect(getCurrentUserRecord).toHaveBeenCalledWith('clerk_123');
    expect(findManyCollections).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        description: true,
        id: true,
        kind: true,
        name: true,
        slug: true,
        smartKey: true,
        sortOrder: true,
        items: {
          select: {
            libraryItem: {
              select: {
                addedAt: true,
                id: true,
                isArchived: true,
                lastOpenedAt: true,
                progress: {
                  select: { completionPercent: true, lastReadAt: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    expect(findManyLibraryItems).toHaveBeenCalledWith({
      where: { id: { in: ['library-a', 'library-b'] } },
      select: {
        id: true,
        slug: true,
        offlineRequested: true,
        book: {
          select: {
            authors: true,
            coverBlob: { select: { mimeType: true } },
            files: { select: { format: true, isPrimary: true, kind: true } },
            id: true,
            title: true,
          },
        },
      },
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
      authors: ['First Author'],
      completionPercent: 25,
      primaryFormat: BookFileFormat.EPUB,
      title: 'First Book',
    });
    expect(payload.collections[0].books[0].coverImageUrl).toBe(
      '/api/library/covers/book-a',
    );
    expect(payload.collections[0].books[1].coverImageUrl).toBeNull();
  });

  it('limits library collection previews to the 4 most recent books', async () => {
    for (let i = 1; i <= 5; i++) {
      registerPreviewBook(
        createPreviewBook({
          authors: ['Author'],
          bookId: `book-${i}`,
          id: `library-${i}`,
          title: `Book ${i}`,
        }),
      );
    }
    findManyCollections.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-preview',
        items: [
          createLightweightItem({
            id: 'library-1',
            lastOpenedAt: '2026-04-10T10:00:00.000Z',
          }),
          createLightweightItem({
            id: 'library-2',
            lastOpenedAt: '2026-04-09T10:00:00.000Z',
          }),
          createLightweightItem({
            id: 'library-3',
            lastOpenedAt: '2026-04-08T10:00:00.000Z',
          }),
          createLightweightItem({
            id: 'library-4',
            lastOpenedAt: '2026-04-07T10:00:00.000Z',
          }),
          createLightweightItem({
            id: 'library-5',
            lastOpenedAt: '2026-04-06T10:00:00.000Z',
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
    // Preview phase should request only the top-N library item ids, not all 5.
    expect(findManyLibraryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['library-1', 'library-2', 'library-3', 'library-4'] },
        },
      }),
    );
  });

  it('keeps empty collections and serializes fallback timestamps safely', async () => {
    registerPreviewBook(
      createPreviewBook({
        authors: [],
        bookId: 'book-c',
        id: 'library-c',
        title: 'Untitled Notes',
      }),
    );
    findManyCollections.mockResolvedValue([
      createCollectionRecord({
        description: 'Your personal uploads.',
        id: 'collection-empty',
        items: [],
        name: 'Empty Shelf',
      }),
      createCollectionRecord({
        id: 'collection-filled',
        items: [
          createLightweightItem({
            addedAt: '2026-04-04T08:30:00.000Z',
            completionPercent: 0,
            id: 'library-c',
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
      authors: [],
      lastReadAt: '2026-04-04T08:30:00.000Z',
      libraryItemId: 'library-c',
      title: 'Untitled Notes',
    });
  });

  it('treats a newer open as fresher engagement than an older lastReadAt', async () => {
    registerPreviewBook(
      createPreviewBook({
        bookId: 'book-reopened',
        id: 'library-reopened',
        title: 'Reopened Book',
      }),
    );
    registerPreviewBook(
      createPreviewBook({
        bookId: 'book-recent-read',
        id: 'library-recent-read',
        title: 'Recently Read Book',
      }),
    );
    findManyCollections.mockResolvedValue([
      createCollectionRecord({
        id: 'collection-engagement',
        items: [
          createLightweightItem({
            addedAt: '2026-04-01T10:00:00.000Z',
            id: 'library-reopened',
            lastOpenedAt: '2026-04-10T09:00:00.000Z',
            lastReadAt: '2026-04-02T08:00:00.000Z',
          }),
          createLightweightItem({
            addedAt: '2026-04-03T10:00:00.000Z',
            id: 'library-recent-read',
            lastReadAt: '2026-04-09T09:00:00.000Z',
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
    expect(payload.book.genres).toEqual([]);
    expect(payload.book.coverImageUrl).toBeNull();
  });

  it('returns only delta fields from getLibraryItemDetails', async () => {
    findFirstLibraryItem.mockResolvedValue({
      addedAt: new Date('2026-04-01T10:00:00.000Z'),
      book: {
        description: 'A gothic classic.',
        estimatedPageCount: 163,
        genres: ['Gothic', 'Horror'],
        language: 'English',
        publishedYear: 1818,
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
      progress: {
        chapterLabel: 'Chapter 7',
        lastReadAt: new Date('2026-04-11T08:30:00.000Z'),
        minutesRead: 195,
      },
      source: 'IMPORTED',
    });

    const payload = await libraryService.getLibraryItemDetails(
      'clerk_123',
      'library-42',
    );

    // Verifies the slim query — no book.title/authors, no coverBlob, no files.
    expect(findFirstLibraryItem).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isArchived: false,
        OR: [{ id: 'library-42' }, { slug: 'library-42' }],
      },
      select: {
        addedAt: true,
        book: {
          select: {
            description: true,
            estimatedPageCount: true,
            genres: true,
            language: true,
            publishedYear: true,
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
        progress: {
          select: {
            chapterLabel: true,
            lastReadAt: true,
            minutesRead: true,
          },
        },
        source: true,
      },
    });
    expect(payload).toEqual({
      details: {
        addedAt: '2026-04-01T10:00:00.000Z',
        approximatePageCount: 163,
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
        description: 'A gothic classic.',
        genres: ['Gothic', 'Horror'],
        language: 'English',
        lastReadAt: '2026-04-11T08:30:00.000Z',
        minutesRead: 195,
        publishedYear: 1818,
        source: 'IMPORTED',
      },
    });
  });

  it('throws not found when the book details target is missing', async () => {
    findFirstLibraryItem.mockResolvedValue(null);
    await expect(
      libraryService.getLibraryItemDetails('clerk_123', 'missing'),
    ).rejects.toThrow('Book not found in library.');
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

  it('sets the offline-requested intent and stamps the timestamp', async () => {
    findFirstLibraryItem.mockResolvedValue({ id: 'item-1' });
    updateLibraryItem.mockResolvedValue({
      id: 'item-1',
      slug: 'a-book',
      offlineRequested: true,
    });

    const payload = await libraryService.setOfflineRequested(
      'clerk_123',
      'a-book',
      true,
    );

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

  it('throws not found when toggling offline on a missing item', async () => {
    findFirstLibraryItem.mockResolvedValue(null);

    await expect(
      libraryService.setOfflineRequested('clerk_123', 'missing', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateLibraryItem).not.toHaveBeenCalled();
  });
});

function createCollectionRecord(
  overrides: Partial<{
    description: string | null;
    id: string;
    items: ReturnType<typeof createLightweightItem>[];
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

function createLightweightItem(
  overrides: Partial<{
    addedAt: string;
    completionPercent: number;
    id: string;
    isArchived: boolean;
    lastOpenedAt: string | null;
    lastReadAt: string | null;
  }> = {},
) {
  const {
    addedAt = '2026-04-01T00:00:00.000Z',
    completionPercent = 0,
    id = 'library-item',
    isArchived = false,
    lastOpenedAt = null,
    lastReadAt = null,
  } = overrides;

  return {
    libraryItem: {
      addedAt: new Date(addedAt),
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

function createPreviewBook(input: {
  authors?: string[];
  bookId: string;
  hasCover?: boolean;
  id: string;
  slug?: string;
  title?: string;
}) {
  return {
    book: {
      authors: input.authors ?? ['Author'],
      coverBlob: input.hasCover === false ? null : { mimeType: 'image/png' },
      files: [
        {
          format: BookFileFormat.EPUB,
          isPrimary: true,
          kind: BookFileKind.SOURCE,
        },
      ],
      id: input.bookId,
      title: input.title ?? 'Book',
    },
    id: input.id,
    slug: input.slug ?? input.id,
  };
}

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
