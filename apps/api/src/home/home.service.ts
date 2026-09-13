import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { buildCoverImageUrl } from '../shared/cover-image-url';
import { daysAgo, startOfDay } from '../shared/date-utils';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../shared/engagement-date';
import { findPrimarySourceFile } from '../shared/primary-book-file';
import { selectHomeCollections } from './collections-panel';

const HOME_ANNOTATION_LIMIT = 3;

// Match the same shape used by LibraryService: cover bytes are served from
// `/api/library/covers/:bookId` and BookFile.readingProgressIndex is a multi-KB
// Json column never rendered on home. Selecting only what we read keeps the
// home payload small.
type LibraryItemRecord = Prisma.LibraryItemGetPayload<{
  include: {
    _count: { select: { annotations: true } };
    book: {
      include: {
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
      };
    };
    progress: true;
  };
}>;

type CatalogEntryRecord = Prisma.CatalogEntryGetPayload<{
  include: {
    book: {
      include: {
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
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
          _count: {
            select: {
              annotations: { where: { userId: user.id } },
            },
          },
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
      }),
      this.prisma.catalogEntry.findMany({
        where: {
          status: 'PUBLISHED',
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
    const annotations = await this.loadRecentAnnotations(user.id, libraryItems);

    return {
      collections: {
        items: selectHomeCollections(collections),
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
            authorLine: formatAuthors(currentEngagement.book.authors),
            progressPercent: currentEngagement.progress?.completionPercent ?? 0,
            title: currentEngagement.book.title,
          }
        : null,
      mastery: createMasteryPayload(recentReadingSessions),
      recentAnnotations: {
        items: annotations,
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

  private async loadRecentAnnotations(
    userId: string,
    libraryItems: LibraryItemRecord[],
  ) {
    // Count first so books without highlights do not consume a slot, then
    // fetch excerpt text only for the three most recently engaged books.
    const recentBooks = libraryItems
      .filter((item) => item._count.annotations > 0)
      .sort(
        (left, right) =>
          compareByEngagementDesc(left, right) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, HOME_ANNOTATION_LIMIT);

    if (recentBooks.length === 0) return [];

    const annotatedBooks = await this.prisma.libraryItem.findMany({
      where: {
        userId,
        isArchived: false,
        id: { in: recentBooks.map((item) => item.id) },
      },
      select: {
        id: true,
        annotations: {
          where: { userId },
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
    const annotationsByBook = new Map(
      annotatedBooks.map((item) => [item.id, item.annotations[0]]),
    );

    return recentBooks.flatMap((item) => {
      const annotation = annotationsByBook.get(item.id);
      if (!annotation) return [];

      return [
        {
          bookTitle: item.book.title,
          colorLabel: annotation.highlightColor ?? 'Archival Yellow',
          createdAt: annotation.createdAt.toISOString(),
          excerpt: annotation.excerpt,
          id: annotation.id,
          note: annotation.note,
        },
      ];
    });
  }
}

function selectCurrentEngagement(libraryItems: LibraryItemRecord[]) {
  const sorted = [...libraryItems].sort(compareByEngagementDesc);

  return sorted[0] ?? null;
}

function serializeCurrentEngagement(item: LibraryItemRecord) {
  const primarySource = findPrimarySourceFile(item.book.files);

  return {
    authors: item.book.authors,
    chapterLabel: item.progress?.chapterLabel ?? 'Opening chapters',
    completionPercent: item.progress?.completionPercent ?? 0,
    coverImageUrl: item.book.coverBlob
      ? buildCoverImageUrl(item.book.id)
      : null,
    lastReadAt: mostRecentEngagementDate(item).toISOString(),
    libraryItemId: item.id,
    nextMilestone: item.progress?.chapterLabel ?? 'Continue where you left off',
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    slug: item.slug,
    title: item.book.title,
  };
}

function serializeCatalogEntry(entry: CatalogEntryRecord) {
  const primarySource = findPrimarySourceFile(entry.book.files);

  return {
    authors: entry.book.authors,
    coverImageUrl: entry.book.coverBlob
      ? buildCoverImageUrl(entry.book.id)
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
