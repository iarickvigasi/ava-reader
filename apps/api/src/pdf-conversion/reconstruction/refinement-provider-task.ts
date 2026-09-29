import { createHash } from 'node:crypto';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import { REFINEMENT_PROMPT } from './generated/refinement-prompt';
import { recognitionSchemas } from './generated/schemas';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function refinementProviderTask(
  input: BookRefinementTask,
  sourceSha256: string,
): ProviderTask {
  const task = validatePacket('BookRefinementTask', structuredClone(input));
  const image = Buffer.from(task.image.base64, 'base64');
  if (
    task.source_sha256 !== sourceSha256 ||
    image.length !== task.image.byte_length ||
    image.toString('base64') !== task.image.base64 ||
    createHash('sha256').update(image).digest('hex') !== task.image.sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const { image: pixels, ...context } = task;
  return {
    taskId: task.task_id,
    purpose: 'resolve_structure',
    sourceSha256,
    pageIndices: [...new Set(task.crops.map((c) => c.page - 1))].sort(
      (a, b) => a - b,
    ),
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      { role: 'system', content: REFINEMENT_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
              image_sha256: pixels.sha256,
              image: {
                width: pixels.width,
                height: pixels.height,
                pixels_per_point: task.pixels_per_point,
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
    responseSchema: recognitionSchemas.BookRefinementResponse,
  };
}
