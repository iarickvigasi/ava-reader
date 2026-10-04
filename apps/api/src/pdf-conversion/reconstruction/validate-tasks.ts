import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parseSourceRefusal } from './source-refusal';
import { bindTaskRefusal } from './bind-task-refusal';

const checked = z
  .object({
    schema_version: z.literal('ava-recognition-tasks-checked-1'),
    request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    task_count: z.number().int().min(1).max(50),
  })
  .strict();

// Pinned Python model validation runs inside the same network-isolated image.
// It checks stable task identity and decodes pixels before any provider spending.
export async function validateRecognitionTasks(
  tasks: RecognitionTask[],
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  responses?: RecognitionResponse[],
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'validate_tasks',
      tasks,
      ...(responses ? { responses } : {}),
    }),
  );
  if (
    !tasks.length ||
    tasks.length > 50 ||
    auxiliaryBytes.length > (responses ? 16 : 8) * 1024 ** 2
  )
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const result = await sandbox({ ...sandboxInput(), auxiliaryBytes });
  if (result.exitCode === 1)
    throw bindTaskRefusal(
      parseSourceRefusal(result.stdout, tasks[0].source_sha256),
      tasks,
    );
  if (result.exitCode !== 0 || result.stdout.length > 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  let raw: unknown;
  try {
    raw = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(result.stdout),
    );
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
  const parsed = checked.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.task_count !== tasks.length ||
    parsed.data.request_sha256 !==
      createHash('sha256').update(auxiliaryBytes).digest('hex')
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
}
