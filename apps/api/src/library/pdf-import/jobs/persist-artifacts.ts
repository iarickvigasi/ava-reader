import type { WorkerResultV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-worker-result-1';
import type { AttemptRecord, Tx } from './types';
import { resultArtifacts } from './result-artifacts';
import { PdfJobError } from './errors';
export async function persistArtifacts(
  tx: Tx,
  attempt: AttemptRecord,
  result: WorkerResultV1,
  mapping: Record<string, string>,
) {
  for (const descriptor of resultArtifacts(result)) {
    const promoted = await tx.pdfArtifact.updateMany({
      where: {
        id: mapping[descriptor.id],
        ownerId: attempt.job.operation.ownerId,
        operationId: null,
        attemptId: null,
        descriptorId: null,
        retention: 'STAGING',
        checksum: descriptor.sha256,
        sizeBytes: descriptor.byte_length,
        mimeType: descriptor.media_type,
        role: descriptor.role,
        expiresAt: { gt: new Date() },
      },
      data: {
        operationId: attempt.job.operationId,
        attemptId: attempt.id,
        descriptorId: descriptor.id,
        retention: 'OPERATION',
        expiresAt: null,
      },
    });
    if (promoted.count !== 1) throw new PdfJobError('PDF_JOB_ARTIFACT_INVALID');
  }
  return mapping;
}
