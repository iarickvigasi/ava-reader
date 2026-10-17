import { isDeepStrictEqual } from 'node:util';
import type { RecognitionTask } from './generated/RecognitionTask';
import { SourceContentError } from './source-refusal';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function bindTaskRefusal(
  error: SourceContentError,
  tasks: RecognitionTask[],
) {
  const diagnostic = error.diagnostic();
  for (const finding of diagnostic.findings) {
    const task = tasks.find((t) => t.task_id === finding.task_id);
    if (
      !task ||
      task.source_sha256 !== diagnostic.source_sha256 ||
      task.image.sha256 !== finding.render_sha256 ||
      task.page_number !== finding.page ||
      !isDeepStrictEqual(task.region_box, finding.region_box)
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  return error;
}
