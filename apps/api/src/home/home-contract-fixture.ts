import {
  type BookFileFormat,
  type BookFileKind,
  type Prisma,
} from '@prisma/client';
import { HomeService } from './home.service';

export function createHomeContractFixture() {
  const user = {
    avatarUrl: null,
    displayName: 'Reader',
    id: 'user-1',
    primaryEmail: 'reader@example.com',
    role: 'USER',
  };
  const findCompletionItems = jest
    .fn<Promise<unknown[]>, [Prisma.LibraryItemFindManyArgs]>()
    .mockResolvedValue([]);
  const prisma = {
    aiComment: { count: jest.fn().mockResolvedValue(0) },
    annotation: { count: jest.fn().mockResolvedValue(0) },
    catalogEntry: { findMany: jest.fn().mockResolvedValue([]) },
    collection: { findMany: jest.fn().mockResolvedValue([]) },
    libraryItem: {
      findMany: jest
        .fn<Promise<unknown[]>, [Prisma.LibraryItemFindManyArgs]>()
        .mockResolvedValue([]),
    },
    readingSessionSegment: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { durationSeconds: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const usersService = {
    getCurrentUserRecord: jest.fn().mockResolvedValue(user),
  };
  const libraryItem = {
    _count: { annotations: 0 },
    addedAt: new Date('2026-08-01T00:00:00.000Z'),
    book: {
      authors: [] as string[],
      coverBlob: null as { mimeType: string } | null,
      files: [] as Array<{
        format: BookFileFormat;
        isPrimary: boolean;
        kind: BookFileKind;
      }>,
      id: 'book-1',
      title: 'Example Title',
    },
    id: 'library-1',
    finishedAt: null,
    lastOpenedAt: null,
    progress: null,
    slug: 'example-title',
  };

  return {
    libraryItem,
    findCompletionItems,
    prisma,
    service: new HomeService(
      {
        ...prisma,
        libraryItem: {
          findMany: (args: Prisma.LibraryItemFindManyArgs) =>
            args.select?.finishedAt
              ? findCompletionItems(args)
              : prisma.libraryItem.findMany(args),
        },
      } as never,
      usersService as never,
    ),
    user,
    usersService,
  };
}
