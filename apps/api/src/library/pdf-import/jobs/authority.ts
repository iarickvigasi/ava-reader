import type { AttemptAuthority, Tx } from './types';
import { authenticateWorker } from './authenticate-worker';
import { databaseNow, lockLibraryItem } from './transaction';
import { matchesSecret } from './secrets';
import { JobAuthorityError } from './errors';
import { assertAttemptScope } from './scope-checks';
import { parseJobPolicy } from './policy';
export async function requireAttempt(
  tx: Tx,
  authority: AttemptAuthority,
  allowReceipt = false,
) {
  authority = { ...authority };
  if (
    typeof authority.attemptId !== 'string' ||
    !authority.attemptId ||
    authority.attemptId.length > 200
  )
    throw new JobAuthorityError();
  const principal = await authenticateWorker(tx, authority);
  const include = { job: { include: { operation: true } } } as const;
  const initial = await tx.pdfJobAttempt.findUnique({
    where: { id: authority.attemptId },
    include,
  });
  if (
    !initial ||
    initial.principalId !== principal.id ||
    !matchesSecret(authority.attemptToken, initial.attemptTokenHash)
  )
    throw new JobAuthorityError();
  await lockLibraryItem(tx, initial.job.operation.libraryItemId);
  const attempt = await tx.pdfJobAttempt.findUniqueOrThrow({
    where: { id: initial.id },
    include,
  });
  const op = attempt.job.operation;
  if (
    !(await tx.libraryItem.findFirst({
      where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
    }))
  )
    throw new JobAuthorityError();
  const now = await databaseNow(tx);
  if (
    principal.workerFingerprint !== attempt.job.workerFingerprint ||
    !principal.modes.includes(attempt.job.providerMode)
  )
    throw new JobAuthorityError();
  const job = assertAttemptScope(attempt, now, allowReceipt);
  return { attempt, job, now, policy: parseJobPolicy(attempt.job.policy) };
}
