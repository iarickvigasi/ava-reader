import { JobAuthorityError } from './errors';
import { matchesSecret } from './secrets';
import type { Tx, WorkerCredential } from './types';
export async function authenticateWorker(tx: Tx, credential: WorkerCredential) {
  if (
    !credential ||
    typeof credential.principalId !== 'string' ||
    !credential.principalId ||
    credential.principalId.length > 200
  )
    throw new JobAuthorityError();
  const principal = await tx.pdfWorkerPrincipal.findUnique({
    where: { id: credential.principalId },
  });
  if (
    !principal ||
    principal.revokedAt ||
    !matchesSecret(credential.token, principal.tokenHash)
  )
    throw new JobAuthorityError();
  return principal;
}
