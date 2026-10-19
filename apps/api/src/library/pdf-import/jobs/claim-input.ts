import type { PdfArtifact, PdfImportOperation } from '@prisma/client';
import { JobAuthorityError } from './errors';
import { validateStructure } from '../../../pdf-conversion/contracts/validate-structure';
import type { JobPolicy } from './policy';
export function createJobInput(input: {
  op: PdfImportOperation;
  source: PdfArtifact;
  policy: JobPolicy;
  fingerprint: string;
  fence: number;
  generation: number;
  mode: string;
  dispatchAuthorizationId?: string | null;
  now: Date;
  deadline: Date;
  pages: number;
}) {
  const { op, source, policy } = input;
  if (input.mode === 'live' && !input.dispatchAuthorizationId)
    throw new JobAuthorityError();
  return validateStructure('ava-pdf-job-1', {
    schema_version: 'ava-pdf-job-1',
    operation_id: op.id,
    owner_id: op.ownerId,
    library_item_id: op.libraryItemId,
    intent: 'initial_pdf_import',
    profile_id: op.profileId,
    source: {
      id: source.id,
      role: 'SOURCE_PDF',
      format: 'PDF',
      media_type: 'application/pdf',
      path: 'source.pdf',
      sha256: op.sourceSha256,
      byte_length: source.sizeBytes,
    },
    request_sha256: op.requestSha256,
    config_sha256: op.configSha256,
    worker_fingerprint: input.fingerprint,
    generation: input.generation,
    attempt_fence: input.fence,
    cancellation_epoch: op.cancellationEpoch,
    provider_mode: input.mode,
    ...(input.mode === 'live'
      ? { dispatch_authority_id: input.dispatchAuthorizationId }
      : {}),
    active_deadline_seconds: Math.max(
      1,
      Math.ceil((input.deadline.getTime() - input.now.getTime()) / 1000),
    ),
    source_page_limit: input.pages,
    scratch_byte_limit: policy.scratchByteLimit,
  });
}
