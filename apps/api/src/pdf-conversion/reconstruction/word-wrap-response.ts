import type { WordWrapTask } from './generated/WordWrapTask';
import { parsePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function wordWrapResponse(task: WordWrapTask, output: string) {
  const response = parsePacket(
    'WordWrapResponse',
    Buffer.from(output),
    8 * 1024 ** 2,
  );
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.observation_sha256 !== task.observation_sha256 ||
    response.catalogue_sha256 !== task.catalogue_sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    response.decisions.length !== task.entries.length ||
    response.decisions.some(
      (decision, index) => decision.id !== task.entries[index].id,
    )
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  return response;
}
