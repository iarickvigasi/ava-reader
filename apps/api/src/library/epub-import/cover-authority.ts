import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
export async function importedCoverAuthority(
  prisma: PrismaService,
  ownerId: string,
  libraryItemId: string,
) {
  const item = await prisma.libraryItem.findFirst({
    where: { id: libraryItemId, userId: ownerId },
    select: {
      bookId: true,
      book: { select: { canonicalImportPrivate: true, coverBlobId: true } },
    },
  });
  if (!item?.book.canonicalImportPrivate || !item.book.coverBlobId)
    throw new NotFoundException('Cover not found.');
  const record = await prisma.canonicalEpubImport.findFirst({
    where: { ownerId, libraryItemId, bookId: item.bookId },
    select: { id: true },
  });
  if (!record) throw new NotFoundException('Cover not found.');
  return { importId: record.id, blobId: item.book.coverBlobId };
}
