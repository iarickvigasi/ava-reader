import { createHash } from 'node:crypto';
import type { AnchorRepairTask } from './anchor-repair-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { exchangeJson } from '../runtime/exchange-json';

// The same pinned worker independently regenerates exact eligibility before paid repair.
export async function validateAnchorContext(
  correction: AnchorRepairTask,
  task: RecognitionTask,
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  signal: AbortSignal,
) {
  const quoteMode =
    correction.schema_version === 'ava-recognition-anchor-quote-task-2';
  const mode = quoteMode ? 'validate_anchor_quote' : 'validate_anchor_context';
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({ mode, task, correction }),
  );
  if (auxiliaryBytes.length > 24 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const input = sandboxInput();
  const result = await sandbox({
    ...input,
    signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal,
    auxiliaryBytes,
    observationCommand: {
      command: mode,
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
    value.schema_version !==
      (quoteMode
        ? 'ava-anchor-quote-checked-2'
        : correction.schema_version === 'ava-recognition-anchor-context-task-2'
          ? 'ava-anchor-context-checked-2'
          : 'ava-anchor-context-checked-1') ||
    value.task_id !== correction.task_id ||
    value.request_sha256 !==
      createHash('sha256').update(auxiliaryBytes).digest('hex')
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
}
