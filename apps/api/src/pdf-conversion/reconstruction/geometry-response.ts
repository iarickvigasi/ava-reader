import type { RecognitionGeometryTask } from './generated/RecognitionGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { parsePacket } from './validate-packet';
import { recognitionResponse } from './recognition-response';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function geometryResponse(
  task: RecognitionGeometryTask,
  output: string,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const response = parsePacket(
    'RecognitionGeometryResponse',
    Buffer.from(output),
    1024 ** 2,
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
    const slot = task.slots[index];
    const box = patch.box;
    if (
      patch.segment_id !== slot.segment_id ||
      box.x0 >= box.x1 ||
      box.y0 >= box.y1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    corrected.segments[slot.segment_index].box = box;
  });
  // Python accepts the complete result against source evidence before the next dispatch.
  return {
    response,
    corrected: recognitionResponse(parent, JSON.stringify(corrected)),
  };
}
