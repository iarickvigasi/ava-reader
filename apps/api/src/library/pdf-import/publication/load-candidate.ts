import type { PrismaService } from '../../../prisma/prisma.service';
import type { SemanticValidator } from '../../../pdf-conversion/contracts/types';
import { validateContract } from '../../../pdf-conversion/contracts/validate-contract';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jobTransaction } from '../jobs/transaction';
import { resultArtifacts } from '../jobs/result-artifacts';
import { candidateAuthority } from './candidate-authority';
import { PdfPublicationError } from './errors';
export async function loadPublicationCandidate(
  prisma: PrismaService,
  operationId: string,
  semantic: SemanticValidator,
) {
  const scope = await jobTransaction(prisma, (tx) =>
    candidateAuthority(tx, operationId),
  );
  const result = await validateContract(
    'ava-pdf-worker-result-1',
    Buffer.from(JSON.stringify(scope.attempt.result)),
    semantic,
  );
  if (
    result.outcome.status !== 'candidate' ||
    result.outcome.canonical_schema !== 'ava-book-2' ||
    result.operation_id !== operationId ||
    result.attempt_fence !== scope.attempt.fence ||
    result.worker_fingerprint !== scope.attempt.principal.workerFingerprint ||
    result.request_sha256 !== scope.op.requestSha256 ||
    result.profile_id !== scope.op.profileId ||
    result.generation !== scope.op.generation ||
    result.cancellation_epoch !== scope.op.cancellationEpoch ||
    result.source_sha256 !== scope.op.sourceSha256 ||
    result.config_sha256 !== scope.op.configSha256
  )
    throw new PdfPublicationError('PDF_CANDIDATE_NOT_QUALIFIED');
  const map = scope.attempt.artifactMap;
  if (!map || typeof map !== 'object' || Array.isArray(map))
    throw new PdfPublicationError('PDF_CANDIDATE_NOT_QUALIFIED');
  const artifacts = await prisma.pdfArtifact.findMany({
    where: {
      operationId,
      attemptId: scope.attempt.id,
      ownerId: scope.op.ownerId,
    },
    include: { blob: true },
  });
  const descriptors = resultArtifacts(result);
  if (artifacts.length !== descriptors.length)
    throw new PdfPublicationError('PDF_CANDIDATE_ARTIFACT_INVALID');
  for (const descriptor of descriptors) {
    const a = artifacts.find((a) => a.id === map[descriptor.id]);
    if (
      !a ||
      a.descriptorId !== descriptor.id ||
      a.role !== descriptor.role ||
      a.retention !== 'OPERATION' ||
      a.mimeType !== descriptor.media_type ||
      a.sizeBytes !== descriptor.byte_length ||
      a.checksum !== descriptor.sha256 ||
      a.blob.bytes.length !== descriptor.byte_length ||
      checksumBuffer(Buffer.from(a.blob.bytes)) !== descriptor.sha256
    )
      throw new PdfPublicationError('PDF_CANDIDATE_ARTIFACT_INVALID');
  }
  return { ...scope, result, outcome: result.outcome, artifacts };
}
