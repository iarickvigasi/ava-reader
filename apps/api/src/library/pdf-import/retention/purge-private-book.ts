import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { databaseNow, jobTransaction } from '../jobs/transaction';
import { requirePdfRetentionInterval } from './activation';
export function purgePrivateOrphanBook(
  prisma: PrismaService,
  bookId: string,
  graceMs: number,
) {
  requirePdfRetentionInterval(graceMs);
  return jobTransaction(prisma, async (tx) => {
    // A concurrent membership insert takes an FK lock on this same Book row.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Book" WHERE id=${bookId} FOR UPDATE`,
    );
    const book = await tx.book.findUnique({
      where: { id: bookId },
      include: {
        _count: { select: { libraryItems: true } },
        catalogEntry: { select: { id: true } },
        pdfImport: { select: { id: true } },
        canonicalEpubImport: { select: { id: true } },
      },
    });
    const now = await databaseNow(tx);
    if (
      !book?.privateOrphanedAt ||
      (!book.pdfImportPrivate && !book.canonicalImportPrivate) ||
      book.privateOrphanedAt.getTime() + graceMs > now.getTime() ||
      book._count.libraryItems ||
      book.catalogEntry ||
      book.pdfImport ||
      book.canonicalEpubImport
    )
      return false;
    await tx.book.delete({ where: { id: book.id } });
    return true;
  });
}
