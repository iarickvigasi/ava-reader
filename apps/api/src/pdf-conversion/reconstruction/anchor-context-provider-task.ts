import { SMALL_CAPS_QUOTE_PROMPT } from './generated/prompt';
import { ANCHOR_QUOTE_PROMPT } from './generated/anchor-quote-prompt';
import { OVERFLOW_CONTEXT_PROMPT } from './generated/prompt';
import { anchorRepairBinding } from './anchor-repair-binding';
import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { ANCHOR_CONTEXT_PROMPT } from './generated/anchor-context-prompt';
import { recognitionSchemas } from './generated/schemas';
import { contextSha } from './anchor-context-binding';

export function anchorContextProviderTask(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
  quoteMode = false,
): ProviderTask {
  const task = anchorRepairBinding(input, parent, original, quoteMode);
  const { image: pixels, ...context } = task;
  return {
    // The stock grant/task ledger enforces one durable opportunity for this parent.
    // Request/schema hashes still bind the complete model correction task separately.
    taskId: 'anchor-context-parent-' + contextSha(task.original_task_id),
    purpose: 'resolve_structure',
    sourceSha256: task.source_sha256,
    pageIndices: [task.page_number - 1],
    promptVersion: task.prompt_version,
    schemaVersion: task.response_schema_version,
    messages: [
      {
        role: 'system',
        content: quoteMode
          ? task.schema_version === 'ava-recognition-anchor-quote-task-3'
            ? SMALL_CAPS_QUOTE_PROMPT
            : ANCHOR_QUOTE_PROMPT
          : task.schema_version === 'ava-recognition-anchor-context-task-2'
            ? OVERFLOW_CONTEXT_PROMPT
            : ANCHOR_CONTEXT_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...context,
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
    responseSchema: quoteMode
      ? recognitionSchemas.RecognitionAnchorQuoteResponse
      : recognitionSchemas.RecognitionAnchorContextResponse,
  };
}
