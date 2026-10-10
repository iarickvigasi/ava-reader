import { createOwnedPdfImport } from './create-owned-import';
import { enqueuePdfJob } from '../jobs/enqueue';
import { serializePdfImport } from './import-status';
import { recordAcceptedImport } from '../reports/accepted-import';
export async function acceptPdfImport(
  tx: Parameters<typeof createOwnedPdfImport>[0],
  input: Parameters<typeof createOwnedPdfImport>[1],
  operationId?: string,
) {
  const operation = await createOwnedPdfImport(tx, input, operationId);
  const job = await enqueuePdfJob(tx, operation.id, input.userId);
  await recordAcceptedImport(tx, operation, job, {
    bytes: input.artifact.sizeBytes,
    pages: input.inspection.page_count,
  });
  return serializePdfImport(operation, 'accepted');
}
