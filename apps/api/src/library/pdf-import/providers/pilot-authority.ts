import type { RouteConfiguration } from './types';
import { PdfProviderError } from './errors';
export function requirePilotOperation(
  config: RouteConfiguration,
  mode: string,
  scope: { operationId: string; ownerId: string; sourceSha256: string },
  workerFingerprint?: string,
) {
  const pilot = config.pilotInventory;
  if (!pilot) {
    if (mode === 'live')
      throw new PdfProviderError('PDF_PROVIDER_PILOT_REQUIRED');
    return;
  }
  const op = pilot.operations.find((o) => o.operationId === scope.operationId);
  if (
    !op ||
    op.ownerId !== scope.ownerId ||
    op.sourceSha256 !== scope.sourceSha256 ||
    (workerFingerprint !== undefined &&
      workerFingerprint !== pilot.workerFingerprint)
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
  return op;
}
export function requirePilotCall(
  config: RouteConfiguration,
  operationId: string,
  call: { taskId: string; taskSha256: string; requestSha256: string },
) {
  if (!config.pilotInventory) return;
  const task = config.pilotInventory.operations
    .find((op) => op.operationId === operationId)
    ?.tasks.find((t) => t.taskId === call.taskId);
  if (
    !task ||
    task.taskSha256 !== call.taskSha256 ||
    task.requestSha256 !== call.requestSha256
  )
    throw new PdfProviderError('PDF_PROVIDER_PILOT_UNAUTHORIZED');
}
