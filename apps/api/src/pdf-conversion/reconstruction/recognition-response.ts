import type { RecognitionTask } from './generated/RecognitionTask';
import { parsePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function recognitionResponse(task: RecognitionTask, output: string) {
  const response = parsePacket(
    'RecognitionResponse',
    Buffer.from(output),
    8 * 1024 ** 2,
  );
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.render_sha256 !== task.image.sha256 ||
    response.segments.some((s) => s.page !== task.page_number)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    response.unresolved?.length ||
    !['en', 'english'].includes(
      response.language.toLowerCase().split('-')[0],
    ) ||
    response.segments.some((s) => s.kind === 'unsupported')
  )
    throw new PdfRuntimeError('UNSUPPORTED_PDF');
  return response;
}
