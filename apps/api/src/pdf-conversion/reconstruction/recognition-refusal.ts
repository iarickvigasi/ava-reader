import { createHash } from 'node:crypto';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import {
  SourceContentError,
  type SourceRefusalDiagnostic,
} from './source-refusal';

export function recognitionRefusal(
  task: RecognitionTask,
  response: RecognitionResponse,
) {
  const unsupported = response.segments.find((s) => s.kind === 'unsupported');
  const code: SourceRefusalDiagnostic['findings'][number]['code'] = unsupported
    ? 'ESSENTIAL_STRUCTURE_UNSUPPORTED'
    : response.unresolved.length
      ? 'RECOGNITION_UNRESOLVED'
      : 'SOURCE_LANGUAGE_UNSUPPORTED';
  if (task.region_box.coordinate_space !== 'page_points_top_left')
    throw new PdfRuntimeError('INVALID_RESULT');
  const crop = {
    ...task.region_box,
    coordinate_space: 'page_points_top_left' as const,
  };
  const raw = unsupported?.box;
  const box = raw
    ? {
        coordinate_space: 'page_points_top_left' as const,
        x0: crop.x0 + (raw.x0 / 1000) * (crop.x1 - crop.x0),
        y0: crop.y0 + (raw.y0 / 1000) * (crop.y1 - crop.y0),
        x1: crop.x0 + (raw.x1 / 1000) * (crop.x1 - crop.x0),
        y1: crop.y0 + (raw.y1 / 1000) * (crop.y1 - crop.y0),
      }
    : crop;
  return new SourceContentError({
    schema_version: 'ava-source-refusal-1',
    source_sha256: task.source_sha256,
    stage: 'extraction',
    findings: [
      {
        code,
        severity: 'blocking',
        page: task.page_number,
        box,
        region_box: crop,
        block_id:
          unsupported && /^[A-Za-z][A-Za-z0-9_.-]{0,119}$/.test(unsupported.id)
            ? unsupported.id
            : null,
        segment_id_sha256: unsupported
          ? createHash('sha256').update(unsupported.id).digest('hex')
          : null,
        task_id: task.task_id,
        render_sha256: task.image.sha256,
      },
    ],
  });
}
