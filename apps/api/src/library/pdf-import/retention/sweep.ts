import type { PrismaService } from '../../../prisma/prisma.service';
import { databaseNow } from '../jobs/transaction';
import { pdfRetentionPolicy } from './policy';
import { requirePdfRetentionTestAuthority } from './activation';
import { purgeDeletedPdfOperation } from './purge-operation';
import { purgeFailedPdfWork } from './purge-failed-work';
import { purgePrivateOrphanBook } from './purge-private-book';
const BATCH = 25;
export async function sweepPrivatePdfContent(prisma: PrismaService) {
  requirePdfRetentionTestAuthority();
  const policy = pdfRetentionPolicy(),
    now = await databaseNow(prisma);
  const deletedCutoff = new Date(now.getTime() - policy.deletedGraceMs);
  const operations = await prisma.pdfImportOperation.findMany({
    where: { deletedAt: { lte: deletedCutoff } },
    orderBy: { deletedAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  const failed = await prisma.pdfImportOperation.findMany({
    where: {
      status: 'FAILED',
      deletedAt: null,
      workPurgedAt: null,
      updatedAt: { lte: new Date(now.getTime() - policy.failedWorkMs) },
    },
    orderBy: { updatedAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  const result = { operations: 0, failedWork: 0, books: 0 };
  for (const op of operations)
    result.operations += Number(
      await purgeDeletedPdfOperation(prisma, op.id, policy.deletedGraceMs),
    );
  for (const op of failed)
    result.failedWork += Number(
      await purgeFailedPdfWork(prisma, op.id, policy.failedWorkMs),
    );
  const books = await prisma.book.findMany({
    where: {
      privateOrphanedAt: { lte: deletedCutoff },
      OR: [{ pdfImportPrivate: true }, { canonicalImportPrivate: true }],
      libraryItems: { none: {} },
      catalogEntry: null,
      pdfImport: null,
      canonicalEpubImport: null,
    },
    orderBy: { privateOrphanedAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  for (const book of books)
    result.books += Number(
      await purgePrivateOrphanBook(prisma, book.id, policy.deletedGraceMs),
    );
  return result;
}
