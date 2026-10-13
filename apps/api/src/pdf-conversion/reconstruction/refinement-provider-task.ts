import { frontmatterTitleProviderTask } from './frontmatter-title-provider-task';
import { createHash } from 'node:crypto';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import {
  BIBLIOGRAPHIC_PROMPT,
  LEGACY_REFINEMENT_PROMPT,
  MIXED_HIERARCHY_PROMPT,
  REFINEMENT_PROMPT,
} from './generated/refinement-prompt';
import { recognitionSchemas } from './generated/schemas';
import {
  type RefinementTask,
  validateRefinementTask,
  refinementResponseName,
} from './refinement-packets';
import { PRINTED_TITLE_PROMPT } from './generated/printed-title-prompt';
import { refinementEvidence } from './refinement-evidence';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { SOURCE_FEATURE_PROMPT } from './generated/refinement-prompt';

export function refinementProviderTask(
  input: RefinementTask,
  sourceSha256: string,
): ProviderTask {
  const task = validateRefinementTask(structuredClone(input));
  if (task.schema_version === 'ava-printed-title-task-2')
    return frontmatterTitleProviderTask(task, sourceSha256);
  const image = Buffer.from(task.image.base64, 'base64');
  if (
    task.source_sha256 !== sourceSha256 ||
    image.length !== task.image.byte_length ||
    image.toString('base64') !== task.image.base64 ||
    createHash('sha256').update(image).digest('hex') !== task.image.sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    task.schema_version === 'ava-printed-title-task-1' &&
    (createHash('sha256').update(task.node.text).digest('hex') !==
      task.node.text_sha256 ||
      new Set(task.crops.map((c) => c.id)).size !== 2 ||
      new Set(task.crops.map((c) => c.part)).size !== 2 ||
      task.crops.some((c) => c.node_id !== task.node.id))
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
          task.schema_version === 'ava-printed-title-task-1'
            ? PRINTED_TITLE_PROMPT
            : task.prompt_version === 'ava-book-refinement-7'
              ? SOURCE_FEATURE_PROMPT
              : task.prompt_version === 'ava-book-refinement-4'
                ? BIBLIOGRAPHIC_PROMPT
                : task.prompt_version === 'ava-book-refinement-3'
                  ? LEGACY_REFINEMENT_PROMPT
                  : task.prompt_version === 'ava-book-refinement-6'
                    ? MIXED_HIERARCHY_PROMPT
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
                task.schema_version === 'ava-printed-title-task-1'
                  ? 'Copy BOTH required_title_evidence IDs for this exact opening node. Classify the unchanged whole heading as title or null; do not infer an author or alter chapter roles.'
                  : "Copy the required evidence IDs for EACH node/edge from these maps. Different nodes on the same page may have different body references. Do not substitute another node's reference crop.",
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
    responseSchema: recognitionSchemas[refinementResponseName(task)],
  };
}
