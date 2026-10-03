import { randomBytes } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  jobTransaction,
  databaseNow,
  lockLibraryItem,
} from '../pdf-import/jobs/transaction';
import { secretDigest } from '../pdf-import/jobs/secrets';
import { hasClaimCapacity } from '../pdf-import/jobs/claim-capacity';
import { DEFAULT_JOB_POLICY } from '../pdf-import/jobs/policy';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
import { requireEpubClaim, type EpubClaim } from './claim-authority';
export async function claimCanonicalEpub(
  prisma: PrismaService,
  beforeClaim?: () => void,
): Promise<(EpubClaim & { leaseRemainingMs: number }) | null> {
  return jobTransaction(prisma, async (tx) => {
    const now = await databaseNow(tx);
    const runs = await tx.bookProcessingRun.findMany({
      where: {
        pipeline: CANONICAL_EPUB_PIPELINE,
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const run of runs) {
      const ownerId = run.canonicalOwnerId,
        libraryItemId = run.canonicalLibraryItemId;
      if (!ownerId || !libraryItemId) continue;
      await lockLibraryItem(tx, libraryItemId);
      const item = await tx.libraryItem.findFirst({
        where: { id: libraryItemId, userId: ownerId, bookId: run.bookId },
      });
      if (
        !item ||
        run.attemptCount >= 3 ||
        (run.activeDeadlineAt && run.activeDeadlineAt <= now)
      ) {
        await tx.bookProcessingRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            completedAt: now,
            errorMessage: 'The EPUB could not be prepared.',
            leaseExpiresAt: null,
            leaseTokenHash: null,
          },
        });
        continue;
      }
      if (
        !(await hasClaimCapacity(
          tx,
          DEFAULT_JOB_POLICY,
          ownerId,
          'canonical-epub-preparation',
          now,
        ))
      )
        continue;
      // Operator configuration must fail before consuming a book's attempt.
      beforeClaim?.();
      const token = randomBytes(32).toString('hex'),
        fence = run.attemptFence + 1;
      await tx.bookProcessingRun.update({
        where: { id: run.id },
        data: {
          status: 'PROCESSING',
          attemptFence: fence,
          attemptCount: { increment: 1 },
          leaseTokenHash: secretDigest(token),
          leaseExpiresAt: new Date(now.getTime() + 30000),
          activeDeadlineAt:
            run.activeDeadlineAt ?? new Date(now.getTime() + 540000),
        },
      });
      const authority = { runId: run.id, ownerId, libraryItemId, fence, token };
      const confirmed = await requireEpubClaim(tx, authority);
      return {
        ...authority,
        leaseRemainingMs:
          confirmed.run.leaseExpiresAt!.getTime() - confirmed.now.getTime(),
      };
    }
    return null;
  });
}
