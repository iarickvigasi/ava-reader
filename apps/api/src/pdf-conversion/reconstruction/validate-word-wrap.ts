import { checksumBuffer } from '../../shared/blob-utils';
import type { WordWrapTask } from './generated/WordWrapTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parseSourceRefusal } from './source-refusal';

export async function validateWordWrap(
  task: WordWrapTask,
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  signal: AbortSignal,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({ mode: 'validate_word_wrap', task, response: null }),
  );
  if (auxiliaryBytes.length > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const input = sandboxInput();
  const result = await sandbox({
    ...input,
    signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal,
    auxiliaryBytes,
    observationCommand: { command: 'validate_word_wrap', page_number: null },
  });
  if (result.exitCode === 1)
    throw parseSourceRefusal(result.stdout, task.source_sha256);
  if (result.exitCode !== 0 || result.stdout.length > 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  const value = exchangeJson(result.stdout) as Record<string, unknown>;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'request_sha256,schema_version,valid' ||
    value.schema_version !== 'ava-word-wrap-validation-1' ||
    value.valid !== true ||
    value.request_sha256 !== checksumBuffer(auxiliaryBytes)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
}
