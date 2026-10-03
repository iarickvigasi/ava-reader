import { createHash } from 'node:crypto';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { PDF_IMPORT_PROFILE } from '../../library/pdf-import/admission/profile';
import type { CoordinatorInput } from './coordinator-types';

export async function validateReconstructionInput(
  input: CoordinatorInput,
  semantic: SemanticValidator,
  workerFingerprint: string,
) {
  if (
    !Buffer.isBuffer(input.source) ||
    input.source.length > PDF_IMPORT_PROFILE.maxSourceBytes
  )
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const jobBytes = Buffer.from(JSON.stringify(input.job));
  const job = await validateContract('ava-pdf-job-1', jobBytes, semantic);
  if (
    job.worker_fingerprint !== workerFingerprint ||
    job.source.path !== 'source.pdf'
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const source = Buffer.from(input.source);
  if (
    source.length !== job.source.byte_length ||
    createHash('sha256').update(source).digest('hex') !== job.source.sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return { job, jobBytes, source };
}
