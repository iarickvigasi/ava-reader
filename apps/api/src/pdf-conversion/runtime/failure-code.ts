import { PdfJobError } from '../../library/pdf-import/jobs/errors';
import { ContractError } from '../contracts/contract-error';
import { PdfRuntimeError, type RuntimeFailure } from './runtime-error';

export function failureCode(error: unknown): RuntimeFailure {
  if (error instanceof PdfRuntimeError) return error.code;
  if (error instanceof ContractError)
    return error.code === 'VALIDATOR_UNAVAILABLE'
      ? 'WORKER_CRASH'
      : 'INVALID_RESULT';
  if (error instanceof PdfJobError) {
    if (error.code === 'SOURCE_MISMATCH') return 'SOURCE_MISMATCH';
    if (
      [
        'PDF_JOB_ARTIFACT_INVALID',
        'PDF_JOB_ARTIFACT_LIMIT',
        'PDF_JOB_RESULT_LIMIT',
      ].includes(error.code)
    )
      return 'INVALID_RESULT';
  }
  return 'WORKER_CRASH';
}
