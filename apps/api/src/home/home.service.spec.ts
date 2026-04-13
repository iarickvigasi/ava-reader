import { BookFileFormat, BookFileKind } from '@prisma/client';
import { HomeService } from './home.service';

describe('HomeService', () => {
  const getCurrentUserRecord = jest.fn();
  const prisma = {
    aiComment: {
      count: jest.fn(),
    },
    annotation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    catalogEntry: {
      findMany: jest.fn(),
    },
    collection: {
      findMany: jest.fn(),
    },
    libraryItem: {
      findMany: jest.fn(),
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
    prisma.annotation.findMany.mockReset();
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
  });

  it('builds home mastery and stats from persisted per-user aggregates', async () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const sixDaysAgoStart = new Date(todayStart);
    sixDaysAgoStart.setUTCDate(sixDaysAgoStart.getUTCDate() - 6);

    prisma.libraryItem.findMany.mockResolvedValue([
      {
        addedAt: new Date('2026-04-01T10:00:00.000Z'),
        book: {
          author: 'Example Author',
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
    prisma.annotation.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-04-10T09:00:00.000Z'),
        excerpt: 'A highlight',
        highlightColor: 'Archival Yellow',
        id: 'annotation-1',
        libraryItem: {
          book: {
            title: 'Example Title',
          },
        },
        note: null,
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
      author: 'Example Author',
      chapterLabel: 'Chapter 4',
      id: 'library-1',
      title: 'Example Title',
    });
  });

  it('counts only full hours for hoursReading', async () => {
    prisma.libraryItem.findMany.mockResolvedValue([]);
    prisma.catalogEntry.findMany.mockResolvedValue([]);
    prisma.readingSessionSegment.findMany.mockResolvedValue([]);
    prisma.annotation.findMany.mockResolvedValue([]);
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
});
