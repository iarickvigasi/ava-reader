import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { FrontmatterTitleTask } from './generated/FrontmatterTitleTask';
import { PRINTED_TITLE_V2_PROMPT } from './generated/printed-title-v2-prompt';
import { recognitionSchemas } from './generated/schemas';
import { validatePacket } from './validate-packet';
import {
  frontmatterTitleEvidence,
  frontmatterTitleImage,
} from './frontmatter-title-binding';

export function frontmatterTitleProviderTask(
  input: FrontmatterTitleTask,
  sourceSha256: string,
): ProviderTask {
  const task = validatePacket('FrontmatterTitleTask', structuredClone(input));
  frontmatterTitleImage(task, sourceSha256);
  const { image, ...context } = task;
  return {
    taskId: task.task_id,
    purpose: 'resolve_structure',
    sourceSha256,
    pageIndices: task.pages.map((page) => page.page - 1).sort((a, b) => a - b),
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    maxOutputTokens: 3072,
    messages: [
      { role: 'system', content: PRINTED_TITLE_V2_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
              required_title_evidence: Object.fromEntries(
                task.nodes.map((node) => [
                  node.id,
                  frontmatterTitleEvidence(task, node.id),
                ]),
              ),
              image_sha256: image.sha256,
              image: {
                width: image.width,
                height: image.height,
                pixels_per_point: task.pixels_per_point,
              },
            }),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${image.media_type};base64,${image.base64}`,
            },
          },
        ],
      },
    ],
    responseSchema: recognitionSchemas.FrontmatterTitleResponse,
  };
}
