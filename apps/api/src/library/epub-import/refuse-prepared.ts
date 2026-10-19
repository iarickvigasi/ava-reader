import type { CanonicalEpubImport } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  databaseNow,
  jobTransaction,
  lockLibraryItem,
} from '../pdf-import/jobs/transaction';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
export async function refusePreparedEpub(
  prisma: PrismaService,
  record: CanonicalEpubImport,
  runId: string,
  fence: number,
  expiredOnly = false,
) {
  return jobTransaction(prisma, async (tx) => {
    await lockLibraryItem(tx, record.libraryItemId);
    const current = await tx.canonicalEpubImport.findUniqueOrThrow({
      where: { id: record.id },
      include: { acceptance: true },
    });
    if (
      current.acceptance ||
      (
        [
          'ownerId',
          'libraryItemId',
          'bookId',
          'sourceFileId',
          'readerFileId',
          'sourceSha256',
          'readerSha256',
          'finalContentId',
          'canonicalDigest',
          'validatorFingerprint',
        ] as const
      ).some((key) => current[key] !== record[key]) ||
      !(await tx.libraryItem.findFirst({
        where: {
          id: record.libraryItemId,
          userId: record.ownerId,
          bookId: record.bookId,
        },
      }))
    )
      return false;
    const now = await databaseNow(tx);
    const changed = await tx.bookProcessingRun.updateMany({
      where: {
        id: runId,
        attemptFence: fence,
        bookId: record.bookId,
        sourceFileId: record.sourceFileId,
        canonicalOwnerId: record.ownerId,
        canonicalLibraryItemId: record.libraryItemId,
        canonicalContentId: record.finalContentId,
        outputFileId: record.readerFileId,
        pipeline: CANONICAL_EPUB_PIPELINE,
        status: 'PROCESSING',
        ...(expiredOnly ? { activeDeadlineAt: { lte: now } } : {}),
        leaseTokenHash: null,
        leaseExpiresAt: null,
      },
      data: {
        status: 'FAILED',
        completedAt: now,
        errorMessage: 'The EPUB could not be prepared.',
      },
    });
    if (changed.count !== 1) return false;
    await tx.bookFile.update({
      where: { id: record.readerFileId },
      data: { processingStatus: 'FAILED' },
    });
    return true;
  });
}
