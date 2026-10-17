import type { Tx } from '../jobs/types';
import { stopOperation } from '../jobs/stop-internal';
import { candidateAuthority } from './candidate-authority';
import { publicationFailureKind } from './classify-error';
export async function reconcileCandidate(
  tx: Tx,
  operationId: string,
  now: Date,
) {
  try {
    return await candidateAuthority(tx, operationId);
  } catch (error) {
    if (publicationFailureKind(error) !== 'authority') throw error;
    const op = await tx.pdfImportOperation.findUnique({
      where: { id: operationId },
    });
    if (op) await stopOperation(tx, op, now, 'PUBLICATION_AUTHORITY_INVALID');
    return null;
  }
}
