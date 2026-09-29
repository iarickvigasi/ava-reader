import type { ExecutionFailure } from './types';
export function failureReason(code: ExecutionFailure) {
  const messages: Record<ExecutionFailure, string> = {
    WORKER_CRASH: 'Conversion could not finish after an interruption.',
    LEASE_EXPIRED: 'Conversion could not finish after an interruption.',
    EXECUTION_TIMEOUT: 'Conversion exceeded its processing time limit.',
    RESOURCE_LIMIT: 'This PDF exceeded a processing limit.',
    INVALID_RESULT: 'Conversion produced an invalid result.',
    SOURCE_MISMATCH: 'The saved PDF could not be verified.',
    DISPATCH_NOT_AUTHORIZED:
      'Conversion is waiting for AVA processing configuration.',
    UNSUPPORTED_PDF: 'This PDF is outside the supported content profile.',
    CONVERSION_FAILED: 'This PDF could not be converted.',
  };
  return messages[code];
}
