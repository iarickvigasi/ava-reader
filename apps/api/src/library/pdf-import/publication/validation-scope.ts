import type { PdfCandidateValidation } from '@prisma/client';
import type { candidateAuthority } from './candidate-authority';
import { PdfPublicationError } from './errors';
export function assertValidationScope(
  validation: PdfCandidateValidation,
  scope: Awaited<ReturnType<typeof candidateAuthority>>,
) {
  if (
    validation.operationId !== scope.op.id ||
    validation.attemptId !== scope.attempt.id ||
    validation.candidateResultSha256 !== scope.attempt.resultSha256 ||
    validation.sourceSha256 !== scope.op.sourceSha256 ||
    validation.configSha256 !== scope.op.configSha256 ||
    validation.generation !== scope.op.generation ||
    validation.cancellationEpoch !== scope.op.cancellationEpoch ||
    validation.attemptFence !== scope.job.attemptFence
  )
    throw new PdfPublicationError('PDF_VALIDATION_STALE');
}
