import type { PrismaService } from '../../prisma/prisma.service';
import { completePdfJob } from '../../library/pdf-import/jobs/complete';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { SemanticValidator } from '../contracts/types';
import type { WorkerResultV1 } from '../contracts/generated/ava-pdf-worker-result-1';
import { checksumBuffer } from '../../shared/blob-utils';
import { SourceContentError } from '../reconstruction/source-refusal';
import { PdfRuntimeError } from './runtime-error';

export function retainSourceRefusal(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
  error: SourceContentError,
  semantic: SemanticValidator,
  observationWatermark?: unknown,
) {
  const diagnostic = error.diagnostic();
  if (
    diagnostic.source_sha256 !== claim.job.source.sha256 ||
    diagnostic.findings.some((f) => f.page > claim.job.source_page_limit)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const bytes = Buffer.from(JSON.stringify(diagnostic));
  if (bytes.length > 64 * 1024) throw new PdfRuntimeError('INVALID_RESULT');
  const job = claim.job;
  const result: WorkerResultV1 = {
    schema_version: 'ava-pdf-worker-result-1',
    operation_id: job.operation_id,
    source_sha256: job.source.sha256,
    request_sha256: job.request_sha256,
    config_sha256: job.config_sha256,
    worker_fingerprint: job.worker_fingerprint,
    profile_id: job.profile_id,
    generation: job.generation,
    attempt_fence: job.attempt_fence,
    cancellation_epoch: job.cancellation_epoch,
    outcome: {
      status: 'unsupported',
      cli_exit_code: 1,
      failure_id: `source-refusal-${job.attempt_fence}`,
      code: diagnostic.findings[0].code,
      stage: diagnostic.stage,
      safe_reason: 'Required source content needs investigation.',
      diagnostic: {
        id: 'source-refusal',
        path: 'source-refusal.json',
        role: 'DIAGNOSTIC',
        format: 'REPORT_JSON',
        media_type: 'application/json',
        sha256: checksumBuffer(bytes),
        byte_length: bytes.length,
      },
      investigation_required: true,
      notification_required: true,
      reader_retry_allowed: false,
    },
  };
  return completePdfJob(prisma, {
    authority: claim.authority,
    semantic,
    observationWatermark,
    completion: { exitCode: 1, bytes: Buffer.from(JSON.stringify(result)) },
    artifacts: [{ id: 'source-refusal', bytes }],
  });
}
