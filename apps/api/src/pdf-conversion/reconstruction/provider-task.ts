import { createHash } from 'node:crypto';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import { recognitionSystemPrompt } from './recognition-system-prompt';
import { recognitionSchemas } from './generated/schemas';
import type { RecognitionTask } from './generated/RecognitionTask';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
const sha = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');

export function providerTask(
  input: RecognitionTask,
  sourceSha256: string,
  page: number,
): ProviderTask {
  const task = validatePacket('RecognitionTask', structuredClone(input));
  const image = Buffer.from(task.image.base64, 'base64');
  const box = task.region_box;
  if (
    task.source_sha256 !== sourceSha256 ||
    task.page_number !== page ||
    image.toString('base64') !== task.image.base64 ||
    image.length !== task.image.byte_length ||
    sha(image) !== task.image.sha256 ||
    sha(task.native_evidence) !== task.native_evidence_sha256 ||
    box.coordinate_space !== 'page_points_top_left' ||
    box.x0 >= box.x1 ||
    box.y0 >= box.y1 ||
    box.x1 > task.page_width_pt ||
    box.y1 > task.page_height_pt
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const { image: pixels, ...context } = task;
  return {
    taskId: task.task_id,
    purpose:
      task.purpose === 'pdf_region_recognition'
        ? 'transcribe_region'
        : 'resolve_structure',
    sourceSha256,
    pageIndices: [page - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      {
        role: 'system',
        content: recognitionSystemPrompt(task.prompt_version),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
              render_sha256: pixels.sha256,
              image: {
                media_type: pixels.media_type,
                width: pixels.width,
                height: pixels.height,
              },
            }),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${pixels.media_type};base64,${pixels.base64}`,
            },
          },
        ],
      },
    ],
    responseSchema: recognitionSchemas.RecognitionResponse,
  };
}
