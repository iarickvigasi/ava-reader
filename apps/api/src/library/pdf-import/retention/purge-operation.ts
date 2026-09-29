import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import { databaseNow, queueLock, lockLibraryItem } from '../jobs/transaction';
import { requirePdfRetentionInterval } from './activation';
export function purgeDeletedPdfOperation(
  prisma: PrismaService,
  operationId: string,
  graceMs: number,
) {
  requirePdfRetentionInterval(graceMs);
  return prisma.$transaction(
    async (tx) => {
      const first = await tx.pdfImportOperation.findUnique({
        where: { id: operationId },
      });
      if (!first) return false;
      // Import uses owner -> queue; keep that order before creating its replay receipt.
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'pdf-import:' + first.ownerId}, 0))`,
      );
      await queueLock(tx);
      await lockLibraryItem(tx, first.libraryItemId);
      const op = await tx.pdfImportOperation.findUnique({
        where: { id: operationId },
      });
      const now = await databaseNow(tx);
      if (
        !op?.deletedAt ||
        op.deletedAt.getTime() + graceMs > now.getTime() ||
        (await tx.libraryItem.findUnique({ where: { id: op.libraryItemId } }))
      )
        return false;
      // The DB trigger atomically retains only request hashes, IDs and failure code.
      await tx.pdfImportOperation.delete({ where: { id: op.id } });
      return true;
    },
    { timeout: 30000 },
  );
}
