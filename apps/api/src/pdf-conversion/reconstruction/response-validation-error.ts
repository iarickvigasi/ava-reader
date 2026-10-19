import { createHash } from 'node:crypto';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { RecognitionTask } from './generated/RecognitionTask';
import {
  hostResponseValidationFinding,
  responseValidationDetails,
  type ResponseValidationDetails,
  type HostResponseValidationFinding,
} from './response-validation-finding';

export class ResponseValidationError extends PdfRuntimeError {
  private readonly details: ResponseValidationDetails;
  private readonly finding: HostResponseValidationFinding | undefined;
  constructor(details: ResponseValidationDetails, task?: RecognitionTask) {
    super('INVALID_RESULT');
    const parsed = responseValidationDetails.safeParse(details);
    this.details = parsed.success
      ? parsed.data
      : {
          origin: 'HOST_RESPONSE',
          category: 'SCHEMA_VALIDATION',
          schema: 'RecognitionResponse',
          checks: [],
          complete: false,
        };
    if (task) {
      try {
        const finding = hostResponseValidationFinding.safeParse({
          ...this.details,
          sourceSha256: task.source_sha256,
          renderSha256: task.image.sha256,
          taskIdSha256: createHash('sha256').update(task.task_id).digest('hex'),
          pageNumber: task.page_number,
        });
        this.finding = finding.success ? finding.data : undefined;
      } catch {
        // Optional diagnostics never replace the original INVALID_RESULT refusal.
      }
    }
  }
  bind(task: RecognitionTask) {
    return new ResponseValidationError(this.details, task);
  }
  diagnostic() {
    return this.finding ? structuredClone(this.finding) : undefined;
  }
}

// Cleanup can wrap the same trusted host failure; never inspect arbitrary causes/messages.
export function responseValidationDiagnostic(
  error: unknown,
  sourceSha256: string,
) {
  const original =
    error instanceof ResponseValidationError
      ? error
      : error instanceof PdfRuntimeError &&
          error.cleanupFailed &&
          error.cause instanceof ResponseValidationError
        ? error.cause
        : undefined;
  const finding = original?.diagnostic();
  return finding?.sourceSha256 === sourceSha256 ? finding : undefined;
}
