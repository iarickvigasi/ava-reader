import { GoneException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { reportId } from '../reports/event-contract';
import { requestKeyHash } from '../reports/record';
import { ownedPdfImport } from './owned-import';
import { pdfLibrarySummary } from './library-summary';

export async function findPdfRequest(
  prisma: PrismaService,
  userId: string,
  requestKey: string,
) {
  // One read-only snapshot prevents mixing an accepted operation with older
  // refusal history. Receipt lookup never repairs the journal or billing rows.
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const operation = await tx.pdfImportOperation.findUnique({
        where: {
          ownerId_idempotencyKey: {
            ownerId: userId,
            idempotencyKey: requestKey,
          },
        },
      });
      if (operation) {
        if (operation.deletedAt)
          throw new GoneException('This import was deleted.');
        return pdfLibrarySummary(
          await ownedPdfImport(tx, userId, operation.id),
        );
      }
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey))
        throw new NotFoundException('Import not found.');
      const hash = requestKeyHash(requestKey);
      const record = await tx.pdfConversionInvestigation.findUnique({
        where: {
          ownerId_requestKeyHash: { ownerId: userId, requestKeyHash: hash },
        },
        select: {
          id: true,
          ownerId: true,
          requestKeyHash: true,
          status: true,
          activeAdmissionCount: true,
          sourceSha256: true,
          sourceBytes: true,
          operationId: true,
          operationKey: true,
          bookId: true,
          libraryItemId: true,
          jobId: true,
          finalContentId: true,
        },
      });
      if (
        !record ||
        record.ownerId !== userId ||
        record.requestKeyHash !== hash ||
        record.status !== 'REFUSED' ||
        record.activeAdmissionCount !== 0 ||
        record.operationId !== null ||
        record.operationKey !== null ||
        record.bookId !== null ||
        record.libraryItemId !== null ||
        record.jobId !== null ||
        record.finalContentId !== null ||
        !reportId.safeParse(record.id).success ||
        typeof record.sourceSha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(record.sourceSha256) ||
        !Number.isSafeInteger(record.sourceBytes) ||
        (record.sourceBytes ?? 0) < 1
      )
        throw new NotFoundException('Import not found.');
      throw new GoneException({
        code: 'PDF_ADMISSION_REFUSED',
        message: 'This PDF upload was not accepted.',
        investigationId: record.id,
        requestKey,
        sourceSha256: record.sourceSha256,
        operationId: null,
      });
    },
    { isolationLevel: 'RepeatableRead', timeout: 5000 },
  );
}
