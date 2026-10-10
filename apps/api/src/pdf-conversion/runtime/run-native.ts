import { createHash } from 'node:crypto';
import type { ContractMap, SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { decodeBundle } from './decode-bundle';
import { validateRuntimeConfig, type PdfRuntimeConfig } from './runtime-config';
import { PdfRuntimeError } from './runtime-error';
import { runSandbox } from './run-sandbox';

export async function runNative(
  jobInput: ContractMap['ava-pdf-job-1'],
  sourceInput: Buffer,
  settings: PdfRuntimeConfig,
  semantic: SemanticValidator,
  signal?: AbortSignal,
  leaseRemainingMs?: () => number,
) {
  const config = validateRuntimeConfig(settings);
  const source = Buffer.from(sourceInput);
  const jobBytes = Buffer.from(JSON.stringify(jobInput));
  const job = await validateContract('ava-pdf-job-1', jobBytes, semantic);
  if (
    job.provider_mode !== 'native' ||
    job.source.path !== 'source.pdf' ||
    job.worker_fingerprint !== config.image.slice(7)
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  if (
    source.length !== job.source.byte_length ||
    createHash('sha256').update(source).digest('hex') !== job.source.sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const result = await runSandbox(
    {
      source,
      jobBytes,
      module: 'ava_pdf_epub.runtime',
      deadlineMs: job.active_deadline_seconds * 1000,
      scratchBytes: job.scratch_byte_limit,
      signal,
      leaseRemainingMs,
      faultContext: config.fault
        ? {
            fault: config.fault,
            operation_id: job.operation_id,
            attempt_fence: job.attempt_fence,
          }
        : undefined,
    },
    config,
  );
  return decodeBundle(job, result, semantic);
}
