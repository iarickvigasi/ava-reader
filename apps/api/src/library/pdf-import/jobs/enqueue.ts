import type { Tx } from './types';
import { assertPdfQueueCapacity } from './queue-capacity';
import { configuredPdfMode } from './configured-mode';
import { secretDigest } from './secrets';
import { grantConfiguredImport } from '../providers/import-grant';
export async function enqueuePdfJob(
  tx: Tx,
  operationId: string,
  ownerId: string,
) {
  const policy = await assertPdfQueueCapacity(tx, ownerId);
  const mode = configuredPdfMode();
  const authorization =
    mode === 'live'
      ? await grantConfiguredImport(tx, operationId, ownerId)
      : {};
  return tx.pdfConversionJob.create({
    data: {
      operationId,
      providerMode: mode,
      ...authorization,
      policy,
      policySha256: secretDigest(JSON.stringify(policy)),
    },
  });
}
