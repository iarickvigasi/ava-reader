import type { Tx } from './types';
import { assertPdfQueueCapacity } from './queue-capacity';
import { configuredPdfMode } from './configured-mode';
import { secretDigest } from './secrets';
export async function enqueuePdfJob(
  tx: Tx,
  operationId: string,
  ownerId: string,
) {
  const policy = await assertPdfQueueCapacity(tx, ownerId);
  return tx.pdfConversionJob.create({
    data: {
      operationId,
      providerMode: configuredPdfMode(),
      policy,
      policySha256: secretDigest(JSON.stringify(policy)),
    },
  });
}
