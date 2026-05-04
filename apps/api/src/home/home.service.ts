import { BookFileKind, type Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { bufferToDataUrl } from '../shared/blob-utils';
import { daysAgo, startOfDay } from '../shared/date-utils';

type LibraryItemRecord = Prisma.LibraryItemGetPayload<{
  include: {
    book: {
      include: {
        coverBlob: true;
        files: true;
      };
    };
    progress: true;
  };
}>;

type CatalogEntryRecord = Prisma.CatalogEntryGetPayload<{
  include: {
    book: {
      include: {
        coverBlob: true;
        files: true;
      };
    };
  };
}>;

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getHome(clerkUserId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const [
      libraryItems,
      featuredCatalogEntries,
      recentReadingSessions,
      annotations,
      collections,
      totalReadingSecondsAggregate,
      highlightsCount,
      completedBooksCount,
      aiCommentsCount,
    ] = await Promise.all([
      this.prisma.libraryItem.findMany({
        where: {
          userId: user.id,
          isArchived: false,
        },
        include: {
          book: {
            include: {
              coverBlob: true,
              files: true,
            },
          },
          progress: true,
        },
      }),
      this.prisma.catalogEntry.findMany({
        where: {
          status: 'PUBLISHED',
        },
        include: {
          book: {
            include: {
              coverBlob: true,
              files: true,
            },
          },
        },
      }),
      this.prisma.readingSessionSegment.findMany({
        where: {
          userId: user.id,
          trackedDay: {
            gte: startOfDay(daysAgo(6)),
          },
        },
        orderBy: {
          trackedDay: 'asc',
        },
        select: {
          durationSeconds: true,
          trackedDay: true,
        },
      }),
      this.prisma.annotation.findMany({
        where: {
          userId: user.id,
        },
        include: {
          libraryItem: {
            include: {
              book: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3,
      }),
      this.prisma.collection.findMany({
        where: {
          userId: user.id,
        },
        include: {
          items: {
            include: {
              libraryItem: {
                include: {
                  progress: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 6,
      }),
      this.prisma.readingSessionSegment.aggregate({
        where: {
          userId: user.id,
        },
        _sum: {
          durationSeconds: true,
        },
      }),
      this.prisma.annotation.count({
        where: {
          userId: user.id,
        },
      }),
      this.prisma.readingProgress.count({
        where: {
          userId: user.id,
          completionPercent: {
            gte: 100,
          },
        },
      }),
      this.prisma.aiComment.count({
        where: {
          userId: user.id,
        },
      }),
    ]);

    const state = libraryItems.length > 0 ? 'POPULATED' : 'EMPTY';
    const currentEngagement = selectCurrentEngagement(libraryItems);
    const totalReadingSeconds =
      totalReadingSecondsAggregate._sum.durationSeconds ?? 0;

    return {
      collections: {
        items: collections.map((collection) => ({
          description: collection.description,
          id: collection.id,
          itemCount: collection.items.length,
          kind: collection.kind,
          name: collection.name,
          smartKey: collection.smartKey,
          unreadCount: collection.items.filter(
            (item) => (item.libraryItem.progress?.completionPercent ?? 0) < 100,
          ).length,
        })),
      },
      currentEngagement: currentEngagement
        ? serializeCurrentEngagement(currentEngagement)
        : null,
      feedback: {
        acceptsScreenshot: true,
      },
      featuredCatalog: {
        entries: featuredCatalogEntries
          .sort(compareCatalogEntries)
          .slice(0, 2)
          .map((entry) => serializeCatalogEntry(entry)),
      },
      listening: currentEngagement
        ? {
            authorLine: `${formatAuthors(currentEngagement.book.authors)} • Listening mode coming soon`,
            progressPercent: currentEngagement.progress?.completionPercent ?? 0,
            title: currentEngagement.book.title,
          }
        : null,
      mastery: createMasteryPayload(recentReadingSessions),
      recentAnnotations: {
        items: annotations.map((annotation) => ({
          bookTitle: annotation.libraryItem.book.title,
          colorLabel: annotation.highlightColor ?? 'Archival Yellow',
          createdAt: annotation.createdAt.toISOString(),
          excerpt: annotation.excerpt,
          id: annotation.id,
          note: annotation.note,
        })),
      },
      state,
      stats: {
        aiComments: aiCommentsCount,
        highlights: highlightsCount,
        hoursReading: Math.floor(totalReadingSeconds / 3600),
        volumesRead: completedBooksCount,
      },
      user: {
        avatarUrl: user.avatarUrl,
        displayName: user.displayName,
        email: user.primaryEmail,
        id: user.id,
        role: user.role,
      },
    };
  }
}

function selectCurrentEngagement(libraryItems: LibraryItemRecord[]) {
  const sorted = [...libraryItems].sort((left, right) => {
    const leftScore = getEngagementTimestamp(left);
    const rightScore = getEngagementTimestamp(right);

    return rightScore - leftScore;
  });

  return sorted[0] ?? null;
}

function getEngagementTimestamp(item: LibraryItemRecord) {
  return getMostRecentEngagementDate(item).getTime();
}

function serializeCurrentEngagement(item: LibraryItemRecord) {
  const primarySource = item.book.files.find(
    (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
  );

  return {
    authors: item.book.authors,
    chapterLabel: item.progress?.chapterLabel ?? 'Opening chapters',
    completionPercent: item.progress?.completionPercent ?? 0,
    coverImageDataUrl: item.book.coverBlob
      ? bufferToDataUrl(item.book.coverBlob.bytes, item.book.coverBlob.mimeType)
      : null,
    id: item.id,
    lastReadAt: getMostRecentEngagementDate(item).toISOString(),
    nextMilestone: item.progress?.chapterLabel ?? 'Continue where you left off',
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    slug: item.slug,
    title: item.book.title,
  };
}

function getMostRecentEngagementDate(item: LibraryItemRecord) {
  const lastReadAtMs = item.progress?.lastReadAt?.getTime() ?? 0;
  const lastOpenedAtMs = item.lastOpenedAt?.getTime() ?? 0;
  const addedAtMs = item.addedAt.getTime();

  return new Date(Math.max(lastReadAtMs, lastOpenedAtMs, addedAtMs));
}

function serializeCatalogEntry(entry: CatalogEntryRecord) {
  const primarySource = entry.book.files.find(
    (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
  );

  return {
    authors: entry.book.authors,
    coverImageDataUrl: entry.book.coverBlob
      ? bufferToDataUrl(
          entry.book.coverBlob.bytes,
          entry.book.coverBlob.mimeType,
        )
      : null,
    description: entry.editorialDescription ?? entry.book.description,
    id: entry.id,
    isFeatured: entry.isFeatured,
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    title: entry.editorialTitle ?? entry.book.title,
  };
}

function createMasteryPayload(
  readingSessions: Array<{ durationSeconds: number; trackedDay: Date }>,
) {
  const daySecondsMap = new Map<string, number>();

  for (const session of readingSessions) {
    const key = session.trackedDay.toISOString().slice(0, 10);
    daySecondsMap.set(
      key,
      (daySecondsMap.get(key) ?? 0) + session.durationSeconds,
    );
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(daysAgo(6 - index));
    const key = date.toISOString().slice(0, 10);
    const minutes = Math.floor((daySecondsMap.get(key) ?? 0) / 60);

    // The client formats the weekday label from `key` using the user's
    // locale — don't ship a server-localized string.
    return {
      goalMet: minutes >= 60,
      key,
      minutes,
    };
  });

  const todayMinutes = days.at(-1)?.minutes ?? 0;

  return {
    dailyGoalMinutes: 60,
    days,
    remainingMinutes: Math.max(60 - todayMinutes, 0),
    todayMinutes,
  };
}

function compareCatalogEntries(
  left: CatalogEntryRecord,
  right: CatalogEntryRecord,
) {
  if (left.isFeatured !== right.isFeatured) {
    return left.isFeatured ? -1 : 1;
  }

  if ((left.featuredRank ?? Infinity) !== (right.featuredRank ?? Infinity)) {
    return (left.featuredRank ?? Infinity) - (right.featuredRank ?? Infinity);
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function formatAuthors(authors: string[]) {
  if (authors.length === 0) {
    return 'Unknown author';
  }

  return authors.join(', ');
}
