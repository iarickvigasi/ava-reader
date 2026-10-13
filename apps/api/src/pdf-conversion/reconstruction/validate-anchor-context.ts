import { createHash } from 'node:crypto';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { exchangeJson } from '../runtime/exchange-json';

// The same pinned worker independently regenerates exact eligibility before paid repair.
export async function validateAnchorContext(
  correction: RecognitionAnchorContextTask,
  task: RecognitionTask,
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  signal: AbortSignal,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({ mode: 'validate_anchor_context', task, correction }),
  );
  if (auxiliaryBytes.length > 24 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const input = sandboxInput();
  const result = await sandbox({
    ...input,
    signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal,
    auxiliaryBytes,
    observationCommand: {
      command: 'validate_anchor_context',
      page_number: null,
    },
  });
  if (result.exitCode !== 0 || result.stdout.length > 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  const value = exchangeJson(result.stdout) as Record<string, unknown>;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'request_sha256,schema_version,task_id' ||
    value.schema_version !== 'ava-anchor-context-checked-1' ||
    value.task_id !== correction.task_id ||
    value.request_sha256 !==
      createHash('sha256').update(auxiliaryBytes).digest('hex')
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
}
