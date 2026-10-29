import { PUBLIC_CATALOG_BOOK } from '../../shared/private-book-access';
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { loadImport } from './load-import';
import { addBookToUserLibraryTx } from '../../library/membership/add-book-to-user-library';

export async function previewImport(
  prisma: PrismaService,
  userId: string,
  editionId: string,
  checksum: string,
) {
  const { entry, receipt, source, output, processed } = await loadImport(
    prisma,
    editionId,
    checksum,
  );
  if (
    (!['PROCESSED', 'READY'].includes(receipt.status) &&
      !(receipt.status === 'WITHDRAWN' && processed)) ||
    !source ||
    !output
  )
    throw new ConflictException('This copy is not ready to preview');
  return prisma.$transaction(async (tx) => {
    const eligible = await tx.catalogEntry.findFirst({
      where: {
        id: entry.id,
        book: {
          visibility: 'PUBLIC',
          privateOwnerId: null,
          AND: [
            { files: { some: { id: source.id, isPrimary: true } } },
            {
              files: {
                some: {
                  id: output.id,
                  isPrimary: true,
                  processingStatus: 'READY',
                },
              },
            },
          ],
        },
      },
      select: { bookId: true },
    });
    if (!eligible) throw new ConflictException('Preview copy changed');
    // The controller verified ADMIN; the lookup above checked this exact processed public copy.
    // Membership-based draft access cannot authorize the first acquisition.
    return addBookToUserLibraryTx(
      tx,
      {
        bookId: eligible.bookId,
        originCatalogEntryId: entry.id,
        source: 'CATALOG',
        userId,
      },
      PUBLIC_CATALOG_BOOK,
    );
  });
}
