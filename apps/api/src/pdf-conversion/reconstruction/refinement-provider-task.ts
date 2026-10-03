import { createHash } from 'node:crypto';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import {
  BIBLIOGRAPHIC_PROMPT,
  LEGACY_REFINEMENT_PROMPT,
  REFINEMENT_PROMPT,
} from './generated/refinement-prompt';
import { recognitionSchemas } from './generated/schemas';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import { validatePacket } from './validate-packet';
import { refinementEvidence } from './refinement-evidence';
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
      {
        role: 'system',
        content:
          task.prompt_version === 'ava-book-refinement-4'
            ? BIBLIOGRAPHIC_PROMPT
            : task.prompt_version === 'ava-book-refinement-3'
              ? LEGACY_REFINEMENT_PROMPT
              : REFINEMENT_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
              ...refinementEvidence(task),
              evidence_instruction:
                "Copy the required evidence IDs for EACH node/edge from these maps. Different nodes on the same page may have different body references. Do not substitute another node's reference crop.",
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
