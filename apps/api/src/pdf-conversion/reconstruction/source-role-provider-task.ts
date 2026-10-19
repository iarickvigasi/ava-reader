import { createHash } from 'node:crypto';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { SourceRoleTask } from './generated/SourceRoleTask';
import { SOURCE_ROLE_PROMPT } from './generated/source-role-prompt';
import { refinementEvidence } from './refinement-evidence';
import { recognitionSchemas } from './generated/schemas';

export function sourceRoleProviderTask(
  task: SourceRoleTask,
  sourceSha256: string,
): ProviderTask {
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
    pageIndices: [task.page - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      { role: 'system', content: SOURCE_ROLE_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
              ...refinementEvidence(task),
              image_sha256: pixels.sha256,
              image: {
                width: pixels.width,
                height: pixels.height,
                pixels_per_point: 2,
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
    responseSchema: recognitionSchemas.SourceRoleResponse,
  };
}
