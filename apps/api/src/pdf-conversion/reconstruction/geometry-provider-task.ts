import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { GEOMETRY_PROMPT } from './generated/geometry-prompt';
import { recognitionSchemas } from './generated/schemas';
import { geometryBinding, geometrySha } from './geometry-binding';

export function geometryProviderTask(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
  raw: string,
): ProviderTask {
  const task = geometryBinding(input, parent, original, raw);
  return {
    // Share the historical durable correction opportunity, including across attempt replay.
    taskId: 'anchor-context-parent-' + geometrySha(task.original_task_id),
    purpose: 'resolve_structure',
    sourceSha256: task.source_sha256,
    pageIndices: [task.page_number - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    maxOutputTokens: 3072,
    messages: [
      { role: 'system', content: GEOMETRY_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              schema_version: task.schema_version,
              task_id: task.task_id,
              purpose: task.purpose,
              source_sha256: task.source_sha256,
              original_task_id: task.original_task_id,
              render_sha256: task.render_sha256,
              original_response_sha256: task.original_response_sha256,
              slots: task.slots.map(({ segment_id, kind, context }) => ({
                segment_id,
                kind,
                context,
              })),
              image: {
                width: task.image.width,
                height: task.image.height,
                media_type: task.image.media_type,
              },
            }),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${task.image.media_type};base64,${task.image.base64}`,
            },
          },
        ],
      },
    ],
    responseSchema: recognitionSchemas.RecognitionGeometryResponse,
  };
}
