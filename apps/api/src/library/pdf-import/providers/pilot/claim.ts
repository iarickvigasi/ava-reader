import type { PrismaService } from '../../../../prisma/prisma.service';
import type { WorkerCredential } from '../../jobs/types';
import { jobTransaction, databaseNow } from '../../jobs/transaction';
import { authenticateWorker } from '../../jobs/authenticate-worker';
import { recoverExpired } from '../../jobs/recover-expired';
import { claimOne } from '../../jobs/claim-one';
import { hasClaimCapacity } from '../../jobs/claim-capacity';
import { parseJobPolicy } from '../../jobs/policy';
import { requirePilotOperation } from '../pilot-authority';
import { loadAuthoredPilotRoute } from './route';
import { requirePilotOperator } from './scope';
import { PdfProviderError } from '../errors';
export async function claimAuthoredPilotJob(
  prisma: PrismaService,
  credential: WorkerCredential,
  routeId: string,
) {
  requirePilotOperator();
  const key = { ...credential };
  return jobTransaction(prisma, async (tx) => {
    const principal = await authenticateWorker(tx, key),
      { pilot, config } = await loadAuthoredPilotRoute(tx, routeId);
    if (
      principal.workerFingerprint !== pilot.workerFingerprint ||
      principal.modes.length !== 1 ||
      principal.modes[0] !== 'live'
    )
      throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
    const now = await databaseNow(tx);
    await recoverExpired(tx, now);
    const jobs = await tx.pdfConversionJob.findMany({
      where: {
        operationId: { in: pilot.operations.map((o) => o.operationId) },
        providerMode: 'live',
        state: 'QUEUED',
        availableAt: { lte: now },
        dispatchAuthorization: { routeId, state: 'ACTIVE' },
        operation: { deletedAt: null, status: 'QUEUED' },
      },
      include: { operation: true },
      orderBy: { createdAt: 'asc' },
      take: 4,
    });
    for (const job of jobs) {
      requirePilotOperation(
        config,
        'live',
        {
          operationId: job.operationId,
          ownerId: job.operation.ownerId,
          sourceSha256: job.operation.sourceSha256,
        },
        principal.workerFingerprint,
      );
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
      const result = await claimOne(tx, job.id, principal, key, now);
      if (result) return result;
    }
    return null;
  });
}
