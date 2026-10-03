import { createOwnedPdfImport } from './create-owned-import';
import { enqueuePdfJob } from '../jobs/enqueue';
import { serializePdfImport } from './import-status';
export async function acceptPdfImport(
  tx: Parameters<typeof createOwnedPdfImport>[0],
  input: Parameters<typeof createOwnedPdfImport>[1],
) {
  const operation = await createOwnedPdfImport(tx, input);
  await enqueuePdfJob(tx, operation.id, input.userId);
  return serializePdfImport(operation, 'accepted');
}
