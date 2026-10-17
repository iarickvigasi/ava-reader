import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import { NATIVE_STRUCTURE_PROMPT } from './generated/native-structure-prompt';
import { recognitionSchemas } from './generated/schemas';
import { nativeStructureTaskBinding } from './native-structure-task-binding';
import { nativeStructurePublicView } from './native-structure-public-view';

export function nativeStructureProviderTask(
  input: NativeStructureTask,
  sourceSha256: string,
  page: number,
): ProviderTask {
  const task = nativeStructureTaskBinding(input, sourceSha256, page);
  return {
    taskId: task.task_id,
    purpose: 'resolve_structure',
    sourceSha256,
    pageIndices: [page - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      { role: 'system', content: NATIVE_STRUCTURE_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify(nativeStructurePublicView(task)),
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
    responseSchema: recognitionSchemas.NativeStructureResponse,
  };
}
