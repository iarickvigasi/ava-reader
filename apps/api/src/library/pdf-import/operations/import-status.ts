import type { PdfImportOperation } from '@prisma/client';

export function serializePdfImport(
  operation: PdfImportOperation,
  state: 'accepted' | 'existing',
) {
  return {
    state,
    operationId: operation.id,
    libraryItemId: operation.libraryItemId,
    status: operation.status,
    stage: operation.stage,
    generation: operation.generation,
    updatedAt: operation.updatedAt.toISOString(),
    sourceArtifactId: operation.sourceArtifactId,
    sourceSha256: operation.sourceSha256,
    finalContentId: operation.finalContentId,
    failureId: operation.failureId,
    progress:
      operation.progressTotal === null
        ? null
        : {
            completed: operation.progressCompleted ?? 0,
            total: operation.progressTotal,
          },
    investigationState: operation.investigationMarkedAt ? 'RECORDED' : null,
    failureCode: operation.failureCode,
    failureReason: operation.failureReason,
    investigationRecorded: Boolean(operation.investigationMarkedAt),
  };
}
