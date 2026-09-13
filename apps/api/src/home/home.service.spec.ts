import { BookFileFormat, BookFileKind, type Prisma } from '@prisma/client';
import { HomeService } from './home.service';

describe('HomeService', () => {
  const getCurrentUserRecord = jest.fn();
  const prisma = {
    aiComment: {
      count: jest.fn(),
    },
    annotation: {
      count: jest.fn(),
    },
    catalogEntry: {
      findMany: jest.fn(),
    },
    collection: {
      findMany: jest.fn(),
    },
    libraryItem: {
      findMany: jest.fn<Promise<unknown[]>, [Prisma.LibraryItemFindManyArgs]>(),
    },
    readingProgress: {
      count: jest.fn(),
    },
    readingSessionSegment: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const usersService = {
    getCurrentUserRecord,
  };
  let homeService: HomeService;

  beforeEach(() => {
    getCurrentUserRecord.mockReset();
    prisma.aiComment.count.mockReset();
    prisma.annotation.count.mockReset();
    prisma.catalogEntry.findMany.mockReset();
    prisma.collection.findMany.mockReset();
    prisma.libraryItem.findMany.mockReset();
    prisma.readingProgress.count.mockReset();
    prisma.readingSessionSegment.aggregate.mockReset();
    prisma.readingSessionSegment.findMany.mockReset();

    homeService = new HomeService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({
      avatarUrl: null,
      displayName: 'Reader',
      id: 'user-1',
      primaryEmail: 'reader@example.com',
      role: 'USER',
    });
    prisma.libraryItem.findMany.mockResolvedValue([]);
    prisma.catalogEntry.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.aggregate.mockResolvedValue({
      _sum: { durationSeconds: 0 },
    });
    prisma.annotation.count.mockResolvedValue(0);
    prisma.readingProgress.count.mockResolvedValue(0);
    prisma.aiComment.count.mockResolvedValue(0);
  });

  it('builds home mastery and stats from persisted per-user aggregates', async () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const sixDaysAgoStart = new Date(todayStart);
    sixDaysAgoStart.setUTCDate(sixDaysAgoStart.getUTCDate() - 6);

    prisma.libraryItem.findMany.mockResolvedValue([
      {
        _count: { annotations: 0 },
        addedAt: new Date('2026-04-01T10:00:00.000Z'),
        book: {
          authors: ['Example Author'],
          coverBlob: null,
          files: [
            {
              format: BookFileFormat.EPUB,
              isPrimary: true,
              kind: BookFileKind.SOURCE,
            },
          ],
          title: 'Example Title',
        },
        id: 'library-1',
        lastOpenedAt: new Date('2026-04-09T08:00:00.000Z'),
        progress: {
          chapterLabel: 'Chapter 4',
          completionPercent: 72,
          lastReadAt: new Date('2026-04-10T08:00:00.000Z'),
        },
      },
    ]);
    prisma.catalogEntry.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.findMany.mockResolvedValue([
      {
        durationSeconds: 1_800,
        trackedDay: sixDaysAgoStart,
      },
      {
        durationSeconds: 3_900,
        trackedDay: todayStart,
      },
    ]);
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.aggregate.mockResolvedValue({
      _sum: {
        durationSeconds: 7_560,
      },
    });
    prisma.annotation.count.mockResolvedValue(5);
    prisma.readingProgress.count.mockResolvedValue(2);
    prisma.aiComment.count.mockResolvedValue(3);

    const home = await homeService.getHome('clerk_1');

    expect(home.mastery.todayMinutes).toBe(65);
    expect(home.mastery.remainingMinutes).toBe(0);
    expect(home.stats).toEqual({
      aiComments: 3,
      highlights: 5,
      hoursReading: 2,
      volumesRead: 2,
    });
    expect(home.currentEngagement).toMatchObject({
      authors: ['Example Author'],
      chapterLabel: 'Chapter 4',
      libraryItemId: 'library-1',
      title: 'Example Title',
    });
  });

  it('includes each collection slug so the client can deep-link it', async () => {
    prisma.libraryItem.findMany.mockResolvedValue([]);
    prisma.catalogEntry.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([
      {
        description: null,
        id: 'collection-1',
        items: [
          {
            libraryItem: {
              addedAt: new Date('2026-08-01T00:00:00.000Z'),
              lastOpenedAt: null,
              progress: { completionPercent: 100, lastReadAt: null },
            },
          },
          {
            libraryItem: {
              addedAt: new Date('2026-08-02T00:00:00.000Z'),
              lastOpenedAt: null,
              progress: null,
            },
          },
        ],
        kind: 'CUSTOM',
        name: 'Stoic Philosophy',
        slug: 'stoic-philosophy',
        smartKey: null,
      },
    ]);
    prisma.readingSessionSegment.aggregate.mockResolvedValue({
      _sum: {
        durationSeconds: 0,
      },
    });
    prisma.annotation.count.mockResolvedValue(0);
    prisma.readingProgress.count.mockResolvedValue(0);
    prisma.aiComment.count.mockResolvedValue(0);

    const home = await homeService.getHome('clerk_1');

    expect(home.collections.items).toEqual([
      expect.objectContaining({
        id: 'collection-1',
        itemCount: 2,
        slug: 'stoic-philosophy',
        unreadCount: 1,
      }),
    ]);
  });

  it('counts only full hours for hoursReading', async () => {
    prisma.libraryItem.findMany.mockResolvedValue([]);
    prisma.catalogEntry.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.aggregate.mockResolvedValue({
      _sum: {
        durationSeconds: 3_000,
      },
    });
    prisma.annotation.count.mockResolvedValue(0);
    prisma.readingProgress.count.mockResolvedValue(0);
    prisma.aiComment.count.mockResolvedValue(0);

    const home = await homeService.getHome('clerk_1');

    expect(home.stats.hoursReading).toBe(0);
  });

  it('loads one quote for only the three most recently engaged books with annotations', async () => {
    prisma.libraryItem.findMany
      .mockResolvedValueOnce([
        createLibraryItem('older-book', {
          lastOpenedAt: new Date('2026-09-07T10:00:00.000Z'),
        }),
        createLibraryItem('newly-added-book', {
          addedAt: new Date('2026-09-08T10:00:00.000Z'),
          progress: null,
        }),
        createLibraryItem('unannotated-book', {
          _count: { annotations: 0 },
          lastOpenedAt: new Date('2026-09-12T10:00:00.000Z'),
        }),
        createLibraryItem('recently-opened-book', {
          lastOpenedAt: new Date('2026-09-09T10:00:00.000Z'),
          progress: { lastReadAt: new Date('2026-09-02T10:00:00.000Z') },
        }),
        createLibraryItem('recently-read-book', {
          progress: { lastReadAt: new Date('2026-09-10T10:00:00.000Z') },
        }),
      ])
      // The database may return the selected books in a different order.
      // Quote creation recency must not override book engagement recency.
      .mockResolvedValueOnce([
        createAnnotatedBook('newly-added-book', {
          createdAt: new Date('2026-09-08T10:00:00.000Z'),
        }),
        createAnnotatedBook('recently-read-book', {
          createdAt: new Date('2026-08-01T10:00:00.000Z'),
          highlightColor: null,
          note: 'A saved note',
        }),
        createAnnotatedBook('recently-opened-book', {
          createdAt: new Date('2026-08-15T10:00:00.000Z'),
        }),
      ]);

    const home = await homeService.getHome('clerk_1');

    expect(home.recentAnnotations.items).toEqual([
      {
        bookTitle: 'Title of recently-read-book',
        colorLabel: 'Archival Yellow',
        createdAt: '2026-08-01T10:00:00.000Z',
        excerpt: 'Quote from recently-read-book',
        id: 'annotation-recently-read-book',
        note: 'A saved note',
      },
      {
        bookTitle: 'Title of recently-opened-book',
        colorLabel: 'jade',
        createdAt: '2026-08-15T10:00:00.000Z',
        excerpt: 'Quote from recently-opened-book',
        id: 'annotation-recently-opened-book',
        note: null,
      },
      {
        bookTitle: 'Title of newly-added-book',
        colorLabel: 'jade',
        createdAt: '2026-09-08T10:00:00.000Z',
        excerpt: 'Quote from newly-added-book',
        id: 'annotation-newly-added-book',
        note: null,
      },
    ]);
    expect(home.currentEngagement?.libraryItemId).toBe('unannotated-book');
    expect(prisma.libraryItem.findMany).toHaveBeenCalledTimes(2);
    const initialQuery = prisma.libraryItem.findMany.mock.calls[0][0];
    expect(initialQuery.where).toEqual({
      userId: 'user-1',
      isArchived: false,
    });
    expect(initialQuery.include?._count).toEqual({
      select: { annotations: { where: { userId: 'user-1' } } },
    });
    expect(initialQuery.include).not.toHaveProperty('annotations');
    expect(prisma.libraryItem.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 'user-1',
        isArchived: false,
        id: {
          in: [
            'recently-read-book',
            'recently-opened-book',
            'newly-added-book',
          ],
        },
      },
      select: {
        id: true,
        annotations: {
          where: { userId: 'user-1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            createdAt: true,
            excerpt: true,
            highlightColor: true,
            id: true,
            note: true,
          },
        },
      },
    });
  });

  it('returns fewer than three quotes when fewer books have annotations', async () => {
    prisma.libraryItem.findMany
      .mockResolvedValueOnce([
        createLibraryItem('only-book'),
        createLibraryItem('unannotated-book', { _count: { annotations: 0 } }),
      ])
      .mockResolvedValueOnce([createAnnotatedBook('only-book')]);

    const home = await homeService.getHome('clerk_1');

    expect(home.recentAnnotations.items).toHaveLength(1);
    expect(home.recentAnnotations.items[0].id).toBe('annotation-only-book');
    expect(prisma.libraryItem.findMany.mock.calls[1][0].where?.id).toEqual({
      in: ['only-book'],
    });
  });

  it.each([
    ['the library is empty', []],
    [
      'no books have annotations',
      [createLibraryItem('unannotated-book', { _count: { annotations: 0 } })],
    ],
  ])('does not query annotation text when %s', async (_label, books) => {
    prisma.libraryItem.findMany.mockResolvedValueOnce(books);

    const home = await homeService.getHome('clerk_1');

    expect(home.recentAnnotations.items).toEqual([]);
    expect(prisma.libraryItem.findMany).toHaveBeenCalledTimes(1);
  });

  it('breaks equal engagement dates consistently by book id', async () => {
    prisma.libraryItem.findMany
      .mockResolvedValueOnce(
        ['book-d', 'book-b', 'book-a', 'book-c'].map((id) =>
          createLibraryItem(id),
        ),
      )
      .mockResolvedValueOnce(
        ['book-c', 'book-a', 'book-b'].map((id) => createAnnotatedBook(id)),
      );

    const home = await homeService.getHome('clerk_1');

    expect(home.recentAnnotations.items.map((item) => item.id)).toEqual([
      'annotation-book-a',
      'annotation-book-b',
      'annotation-book-c',
    ]);
    expect(prisma.libraryItem.findMany.mock.calls[1][0].where?.id).toEqual({
      in: ['book-a', 'book-b', 'book-c'],
    });
  });

  it('skips books or annotations removed between counting and fetching', async () => {
    prisma.libraryItem.findMany
      .mockResolvedValueOnce([
        createLibraryItem('book-a'),
        createLibraryItem('book-b'),
        createLibraryItem('book-c'),
      ])
      .mockResolvedValueOnce([
        { id: 'book-a', annotations: [] },
        createAnnotatedBook('book-c'),
      ]);

    const home = await homeService.getHome('clerk_1');

    expect(home.recentAnnotations.items.map((item) => item.id)).toEqual([
      'annotation-book-c',
    ]);
  });
});

function createLibraryItem(
  id: string,
  overrides: {
    _count?: { annotations: number };
    addedAt?: Date;
    lastOpenedAt?: Date | null;
    progress?: { lastReadAt: Date | null } | null;
  } = {},
) {
  return {
    _count: { annotations: 5 },
    addedAt: new Date('2026-08-01T00:00:00.000Z'),
    book: {
      authors: ['Example Author'],
      coverBlob: null,
      files: [],
      title: `Title of ${id}`,
    },
    id,
    lastOpenedAt: null,
    progress: null,
    slug: id,
    ...overrides,
  };
}

function createAnnotatedBook(
  id: string,
  overrides: {
    createdAt?: Date;
    highlightColor?: string | null;
    note?: string | null;
  } = {},
) {
  return {
    id,
    annotations: [
      {
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        excerpt: `Quote from ${id}`,
        highlightColor: 'jade',
        id: `annotation-${id}`,
        note: null,
        ...overrides,
      },
    ],
  };
}
