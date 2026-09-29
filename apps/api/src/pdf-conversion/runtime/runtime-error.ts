export type RuntimeFailure =
  | 'UNSUPPORTED_PDF'
  | 'WORKER_CRASH'
  | 'EXECUTION_TIMEOUT'
  | 'RESOURCE_LIMIT'
  | 'INVALID_RESULT'
  | 'SOURCE_MISMATCH'
  | 'DISPATCH_NOT_AUTHORIZED';

export class PdfRuntimeError extends Error {
  constructor(
    readonly code: RuntimeFailure,
    readonly faultAcknowledgement?: FaultAcknowledgement,
    readonly cleanupFailed = false,
  ) {
    super(code);
    this.name = 'PdfRuntimeError';
  }
  get faultAcknowledged() {
    return this.faultAcknowledgement !== undefined;
  }
}
import type { FaultAcknowledgement } from './fault-acknowledgement';
