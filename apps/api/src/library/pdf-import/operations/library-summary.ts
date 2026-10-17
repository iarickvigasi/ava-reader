import type { PdfImportOperation, Prisma } from '@prisma/client';

export const pdfLibrarySummarySelect = {
  id: true,
  libraryItemId: true,
  status: true,
  stage: true,
  generation: true,
  updatedAt: true,
  sourceArtifactId: true,
  finalContentId: true,
  failureId: true,
  progressCompleted: true,
  progressTotal: true,
  investigationMarkedAt: true,
} satisfies Prisma.PdfImportOperationSelect;

export type PdfLibraryRecord = Pick<
  PdfImportOperation,
  keyof typeof pdfLibrarySummarySelect
>;

export function pdfLibrarySummary(
  operation: PdfLibraryRecord | null | undefined,
) {
  if (!operation) return null;
  return {
    operationId: operation.id,
    libraryItemId: operation.libraryItemId,
    status: operation.status,
    stage: operation.stage,
    generation: operation.generation,
    updatedAt: operation.updatedAt.toISOString(),
    sourceArtifactId: operation.sourceArtifactId,
    finalContentId: operation.finalContentId,
    failureId: operation.failureId,
    investigationRecorded: Boolean(operation.investigationMarkedAt),
    progress:
      operation.progressTotal === null
        ? null
        : {
            completed: operation.progressCompleted ?? 0,
            total: operation.progressTotal,
          },
  };
}
