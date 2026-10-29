import type { PrismaService } from '../../prisma/prisma.service';
import { privateBookAccess } from '../../shared/private-book-access';
import { readStoredBlob } from '../../catalog/publication/read-stored-blob';

export async function loadBookCover(
  prisma: PrismaService,
  bookId: string,
  userId: string,
) {
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      AND: privateBookAccess(userId),
      libraryItems: { some: { userId } },
    },
    select: {
      coverBlob: {
        select: {
          bytes: true,
          mimeType: true,
          catalogBlobId: true,
          checksum: true,
        },
      },
    },
  });
  if (!book?.coverBlob) return null;
  return book.coverBlob.catalogBlobId
    ? { ...book.coverBlob, bytes: await readStoredBlob(book.coverBlob) }
    : book.coverBlob;
}
