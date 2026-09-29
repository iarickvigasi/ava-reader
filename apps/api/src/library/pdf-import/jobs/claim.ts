import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction, databaseNow } from './transaction';
import { authenticateWorker } from './authenticate-worker';
import { recoverExpired } from './recover-expired';
import { parseJobPolicy } from './policy';
import { hasClaimCapacity } from './claim-capacity';
import { claimOne } from './claim-one';
import type { WorkerCredential } from './types';
export function claimPdfJob(
  prisma: PrismaService,
  credential: WorkerCredential,
) {
  const snapshot = { ...credential };
  return jobTransaction(prisma, async (tx) => {
    const principal = await authenticateWorker(tx, snapshot),
      now = await databaseNow(tx);
    await recoverExpired(tx, now);
    const jobs = await tx.pdfConversionJob.findMany({
      where: {
        state: 'QUEUED',
        availableAt: { lte: now },
        providerMode: {
          in: principal.modes.filter((mode) =>
            ['native', 'stub', 'replay'].includes(mode),
          ),
        },
        OR: [
          { workerFingerprint: null },
          { workerFingerprint: principal.workerFingerprint },
        ],
        operation: { deletedAt: null, status: 'QUEUED' },
      },
      include: { operation: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    for (const job of jobs) {
      if (
        !(await hasClaimCapacity(
          tx,
          parseJobPolicy(job.policy),
          job.operation.ownerId,
          principal.id,
          now,
        ))
      )
        continue;
      const result = await claimOne(tx, job.id, principal, snapshot, now);
      if (result) return result;
    }
    return null;
  });
}
