import type { PrismaService } from '../../../prisma/prisma.service';
import {
  databaseNow,
  jobTransaction,
  lockLibraryItem,
} from '../jobs/transaction';
import { requirePdfRetentionInterval } from './activation';
export function purgeFailedPdfWork(
  prisma: PrismaService,
  operationId: string,
  ageMs: number,
) {
  requirePdfRetentionInterval(ageMs);
  return jobTransaction(prisma, async (tx) => {
    const first = await tx.pdfImportOperation.findUnique({
      where: { id: operationId },
    });
    if (!first) return false;
    await lockLibraryItem(tx, first.libraryItemId);
    const op = await tx.pdfImportOperation.findUnique({
      where: { id: operationId },
    });
    const now = await databaseNow(tx);
    if (
      !op ||
      op.status !== 'FAILED' ||
      op.deletedAt ||
      op.workPurgedAt ||
      op.updatedAt.getTime() + ageMs > now.getTime()
    )
      return false;
    await tx.pdfImportOperation.update({
      where: { id: op.id },
      data: { workPurgedAt: now },
    });
    const covers = await tx.pdfArtifact.findMany({
      where: { operationId, role: 'COVER' },
      select: { blobId: true },
    });
    await tx.book.updateMany({
      where: {
        id: op.bookId,
        coverBlobId: { in: covers.map((a) => a.blobId) },
      },
      data: { coverBlobId: null },
    });
    await tx.pdfArtifact.deleteMany({
      where: {
        operationId,
        id: { not: op.sourceArtifactId },
        retention: { not: 'ACCEPTED' },
      },
    });
    await tx.pdfProviderPayload.deleteMany({
      where: { call: { grant: { operationId } } },
    });
    await tx.pdfMetadataClaim.deleteMany({ where: { operationId } });
    return true;
  });
}
