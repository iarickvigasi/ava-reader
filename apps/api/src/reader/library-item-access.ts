import { BookFileKind, ProcessingStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

export async function getOwnedLibraryItem(
  prisma: PrismaService,
  usersService: UsersService,
  clerkUserId: string,
  libraryItemId: string,
) {
  const user = await usersService.getCurrentUserRecord(clerkUserId);
  const libraryItem = await prisma.libraryItem.findFirst({
    where: {
      userId: user.id,
      OR: [{ id: libraryItemId }, { slug: libraryItemId }],
    },
    include: {
      book: {
        include: {
          files: {
            select: {
              id: true,
              blobId: true,
              createdAt: true,
              format: true,
              isPrimary: true,
              kind: true,
              processingStatus: true,
              readingProgressIndex: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          processingRuns: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
      progress: true,
    },
  });

  if (!libraryItem) {
    throw new NotFoundException('The requested library item was not found.');
  }

  return libraryItem;
}

export type OwnedLibraryItem = Awaited<ReturnType<typeof getOwnedLibraryItem>>;

// "Is this book actually readable yet" — the same predicate the READY payload
// and the progress write both gate on.
export function findReadyDerivedReader(libraryItem: OwnedLibraryItem) {
  return libraryItem.book.files.find(
    (file) =>
      file.kind === BookFileKind.DERIVED_READER &&
      file.isPrimary &&
      file.processingStatus === ProcessingStatus.READY,
  );
}
