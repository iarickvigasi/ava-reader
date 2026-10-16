import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { validatePacket } from './validate-packet';
import { exchangeJson } from '../runtime/exchange-json';
import { recognitionResponse } from './recognition-response';
import { PdfRuntimeError } from '../runtime/runtime-error';
export function cellGeometryResponse(
  task: RecognitionCellGeometryTask,
  output: string,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const bytes = Buffer.from(output);
  if (bytes.length > 1024 ** 2) throw new PdfRuntimeError('RESOURCE_LIMIT');
  if (bytes.toString('utf8') !== output)
    throw new PdfRuntimeError('INVALID_RESULT');
  const response = validatePacket(
    'RecognitionCellGeometryResponse',
    exchangeJson(bytes),
  );
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.original_task_id !== task.original_task_id ||
    response.render_sha256 !== task.render_sha256 ||
    response.original_response_sha256 !== task.original_response_sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (response.outcome === 'unresolved') {
    if (response.patches.length || !response.unresolved_reason)
      throw new PdfRuntimeError('INVALID_RESULT');
    return { response, corrected: null };
  }
  if (
    response.unresolved_reason != null ||
    response.patches.length !== task.slots.length
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const corrected = structuredClone(original);
  response.patches.forEach((patch, index) => {
    const s = task.slots[index],
      a = s.table_box,
      b = patch.box;
    if (
      patch.slot_id !== s.slot_id ||
      !(
        a.x0 <= b.x0 &&
        b.x0 < b.x1 &&
        b.x1 <= a.x1 &&
        a.y0 <= b.y0 &&
        b.y0 < b.y1 &&
        b.y1 <= a.y1
      )
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    corrected.segments[s.segment_index].cells![s.row_index][s.cell_index].box =
      b;
  });
  return {
    response,
    corrected: recognitionResponse(parent, JSON.stringify(corrected)),
  };
}
