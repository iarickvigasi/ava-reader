import { HttpException } from '@nestjs/common';
import { reportId } from './event-contract';
export function admissionRefusalResponse(
  error: HttpException,
  investigationId: string,
) {
  const raw = error.getResponse();
  const body =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const code =
    typeof body.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(body.code)
      ? body.code
      : error.getStatus() === 413
        ? 'PDF_UPLOAD_TOO_LARGE'
        : 'PDF_UPLOAD_INVALID';
  const reference = (value: unknown) =>
    reportId.safeParse(value).success ? (value as string) : undefined;
  return {
    code,
    message:
      code === 'PDF_IMPORT_ACCEPTED_REPORT_PENDING'
        ? 'PDF import was accepted, but its report could not finish.'
        : 'PDF import was not accepted.',
    investigationId,
    ...(code === 'PDF_ALREADY_IMPORTED' ||
    code === 'PDF_IMPORT_ACCEPTED_REPORT_PENDING'
      ? {
          operationId: reference(body.operationId),
          libraryItemId: reference(body.libraryItemId),
          status: [
            'QUEUED',
            'RUNNING',
            'WAITING',
            'READY',
            'FAILED',
            'STOPPED',
          ].includes(String(body.status))
            ? body.status
            : undefined,
        }
      : {}),
  };
}
