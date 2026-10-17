import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction, databaseNow, lockLibraryItem } from './transaction';
import { stopOperation } from './stop-internal';
import { PdfJobError } from './errors';
export function stopPdfJob(prisma: PrismaService, operationId: string) {
  return jobTransaction(prisma, async (tx) => {
    const initial = await tx.pdfImportOperation.findUnique({
      where: { id: operationId },
    });
    if (!initial) throw new PdfJobError('PDF_JOB_NOT_FOUND');
    await lockLibraryItem(tx, initial.libraryItemId);
    const op = await tx.pdfImportOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    return stopOperation(tx, op, await databaseNow(tx), 'ADMINISTRATIVE_STOP');
  });
}
