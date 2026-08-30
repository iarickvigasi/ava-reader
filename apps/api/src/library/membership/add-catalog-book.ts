import { LibrarySource } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { addBookToUserLibraryTx } from './add-book-to-user-library';

// Adds a PUBLISHED catalog entry's book to the user's library — the same core
// as import, with the originating entry recorded
// (docs/specs/7-library/7.4-import.md §6).
export function addCatalogBook(options: {
  entryId: string;
  prisma: PrismaService;
  userId: string;
}) {
  return options.prisma.$transaction(async (tx) => {
    const entry = await tx.catalogEntry.findFirst({
      where: {
        id: options.entryId,
        status: 'PUBLISHED',
      },
      include: {
        book: true,
      },
    });

    if (!entry) {
      throw new BadRequestException(
        'The requested catalog book is not available.',
      );
    }

    return addBookToUserLibraryTx(tx, {
      bookId: entry.bookId,
      originCatalogEntryId: entry.id,
      source: LibrarySource.CATALOG,
      userId: options.userId,
    });
  });
}
