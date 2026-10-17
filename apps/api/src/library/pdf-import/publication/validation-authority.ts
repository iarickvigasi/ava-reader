import type { Tx, WorkerCredential } from '../jobs/types';
import { authenticateWorker } from '../jobs/authenticate-worker';
import { matchesSecret } from '../jobs/secrets';
import { databaseNow } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { PdfPublicationError } from './errors';
export type ValidationAuthority = WorkerCredential & {
  operationId: string;
  fence: number;
  validationToken: string;
};
export async function requireValidationRun(
  tx: Tx,
  authority: ValidationAuthority,
) {
  await authenticateWorker(tx, authority);
  const scope = await candidateAuthority(tx, authority.operationId),
    now = await databaseNow(tx);
  const run = await tx.pdfValidationRun.findUnique({
    where: { operationId: scope.op.id },
  });
  if (
    !run ||
    run.state !== 'RUNNING' ||
    run.attemptId !== scope.attempt.id ||
    run.fence !== authority.fence ||
    run.principalId !== authority.principalId ||
    !run.tokenHash ||
    !matchesSecret(authority.validationToken, run.tokenHash) ||
    !run.leaseExpiresAt ||
    run.leaseExpiresAt <= now ||
    !scope.job.deadlineAt ||
    scope.job.deadlineAt <= now
  )
    throw new PdfPublicationError('PDF_VALIDATION_AUTHORITY_INVALID');
  return { ...scope, run, now };
}
