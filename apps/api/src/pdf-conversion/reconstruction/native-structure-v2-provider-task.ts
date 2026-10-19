import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { NativeStructureTask2 } from './generated/NativeStructureTask2';
import { NATIVE_STRUCTURE_V2_PROMPT } from './generated/native-structure-v2-prompt';
import { recognitionSchemas } from './generated/schemas';
import { nativeStructure2TaskBinding } from './native-structure-v2-task-binding';
import { nativeStructurePublicView } from './native-structure-public-view';

export function nativeStructure2ProviderTask(
  input: NativeStructureTask2,
  sourceSha256: string,
  page: number,
): ProviderTask {
  const task = nativeStructure2TaskBinding(input, sourceSha256, page);
  return {
    taskId: task.task_id,
    purpose: 'resolve_structure',
    sourceSha256,
    pageIndices: [page - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      { role: 'system', content: NATIVE_STRUCTURE_V2_PROMPT },
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
    responseSchema: recognitionSchemas.NativeStructureResponse2,
  };
}
