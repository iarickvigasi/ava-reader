import type { AttemptContext } from './attempt-provider';
import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import type { localizeCellGeometry } from './local-cell-geometry';

export function observeLocalCellGeometry(
  task: RecognitionCellGeometryTask,
  result: Awaited<ReturnType<typeof localizeCellGeometry>>,
  context: AttemptContext,
) {
  const observer = context.deps.observer;
  if (!observer) return;
  try {
    observer.emit(
      'VALIDATION',
      'LOCAL_CELL_GEOMETRY',
      observer.nextUnit('local-cell-geometry'),
      {
        pageIndices: [task.page_number - 1],
        localCellGeometry: {
          origin: 'LOCAL_OCR',
          method: result.method,
          taskId: result.task_id,
          requestSha256: result.request_sha256,
          languages: result.languages,
          renderSha256: result.render_sha256,
          originalResponseSha256: result.original_response_sha256,
          proofSha256: result.proofSha256,
          tsvSha256: result.tsv_sha256,
          responseSha256: result.response_sha256,
          binarySha256: result.binary_sha256,
          traineddataSha256: result.traineddata_sha256,
          status: result.status,
          reason: result.reason,
          slotCount: task.slots.length,
          providerCalls: 0,
          providerCostNano: '0',
        },
      },
    );
  } catch {
    /* Optional safe observations cannot change correction authority. */
  }
}
