import type { Prisma } from '@prisma/client';
import { databaseNow, lockLibraryItem } from '../pdf-import/jobs/transaction';
import { matchesSecret } from '../pdf-import/jobs/secrets';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
export type EpubClaim = {
  runId: string;
  fence: number;
  token: string;
  ownerId: string;
  libraryItemId: string;
};
export async function requireEpubClaim(
  tx: Prisma.TransactionClient,
  claim: EpubClaim,
) {
  await lockLibraryItem(tx, claim.libraryItemId);
  const run = await tx.bookProcessingRun.findUniqueOrThrow({
    where: { id: claim.runId },
  });
  const now = await databaseNow(tx);
  if (
    run.pipeline !== CANONICAL_EPUB_PIPELINE ||
    run.status !== 'PROCESSING' ||
    run.attemptFence !== claim.fence ||
    run.canonicalOwnerId !== claim.ownerId ||
    run.canonicalLibraryItemId !== claim.libraryItemId ||
    !run.leaseTokenHash ||
    !matchesSecret(claim.token, run.leaseTokenHash) ||
    !run.leaseExpiresAt ||
    run.leaseExpiresAt <= now ||
    !run.activeDeadlineAt ||
    run.activeDeadlineAt <= now ||
    !(await tx.libraryItem.findFirst({
      where: {
        id: claim.libraryItemId,
        userId: claim.ownerId,
        bookId: run.bookId,
      },
    }))
  )
    throw new Error('EPUB_IMPORT_AUTHORITY_INVALID');
  return { run, now };
}
