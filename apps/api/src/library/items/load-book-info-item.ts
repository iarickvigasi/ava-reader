import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { ownedLibraryItemWhere } from './library-item-access';

export async function loadBookInfoItem(options: {
  prisma: PrismaService;
  ref: string;
  userId: string;
}) {
  const item = await options.prisma.libraryItem.findFirst({
    where: ownedLibraryItemWhere(options.userId, options.ref),
    include: {
      book: {
        include: {
          coverBlob: { select: { mimeType: true } },
          // files.readingProgressIndex is a multi-KB JSON we never render
          // here — see the note in collections/get-collection.ts.
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

  if (!item) {
    throw new NotFoundException('Book not found in library.');
  }

  return item;
}
