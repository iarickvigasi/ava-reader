import type { ProviderTask } from '../../library/pdf-import/providers/types';
import type { WordWrapTask } from './generated/WordWrapTask';
import {
  WORD_WRAP_PROMPT,
  WORD_WRAP_PROMPT_VERSION,
  WORD_WRAP_RESPONSE_SCHEMA_VERSION,
} from './generated/word-wrap-prompt';
import { recognitionSchemas } from './generated/schemas';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function wordWrapProviderTask(
  input: WordWrapTask,
  sourceSha256: string,
  profileId: string,
): ProviderTask {
  const task = validatePacket('WordWrapTask', input);
  if (task.source_sha256 !== sourceSha256 || task.profile_id !== profileId)
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    task.batch_index >= task.batch_count ||
    new Set(task.entries.map((e) => e.id)).size !== task.entries.length ||
    task.entries.some(
      (e) =>
        Array.from(e.context).length > 256 ||
        e.candidate.source_sha256 !== sourceSha256,
    )
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  // The worker validates private source witnesses before advertisement. Only finite
  // lexical context and opaque IDs cross the model boundary.
  const { entries: privateEntries, ...identity } = task;
  const body = JSON.stringify({
    ...identity,
    entries: privateEntries.map(({ id, role, language, context }) => ({
      id,
      role,
      language,
      context,
    })),
  });
  if (Buffer.byteLength(body) > 48 * 1024)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  return {
    taskId: task.task_id,
    purpose: 'resolve_structure',
    sourceSha256,
    pageIndices: [
      ...new Set(
        privateEntries.flatMap((e) => [e.left.page - 1, e.right.page - 1]),
      ),
    ].sort((a, b) => a - b),
    promptVersion: WORD_WRAP_PROMPT_VERSION,
    schemaVersion: WORD_WRAP_RESPONSE_SCHEMA_VERSION,
    maxOutputTokens: 3072,
    messages: [
      { role: 'system', content: WORD_WRAP_PROMPT },
      { role: 'user', content: body },
    ],
    responseSchema: recognitionSchemas.WordWrapResponse,
  };
}
