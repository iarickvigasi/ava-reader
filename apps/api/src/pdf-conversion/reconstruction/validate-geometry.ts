import { createHash } from 'node:crypto';
import type { RecognitionGeometryTask } from './generated/RecognitionGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { exchangeJson } from '../runtime/exchange-json';

export async function validateGeometry(
  task: RecognitionGeometryTask,
  original: RecognitionTask,
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  signal: AbortSignal,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'validate_geometry',
      task,
      original,
      response: null,
    }),
  );
  if (auxiliaryBytes.length > 24 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const input = sandboxInput();
  const result = await sandbox({
    ...input,
    signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal,
    auxiliaryBytes,
    observationCommand: { command: 'validate_geometry', page_number: null },
  });
  if (result.exitCode !== 0 || result.stdout.length > 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  const value = exchangeJson(result.stdout) as Record<string, unknown>;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'request_sha256,schema_version,valid' ||
    value.schema_version !== 'ava-recognition-geometry-validation-1' ||
    value.valid !== true ||
    value.request_sha256 !==
      createHash('sha256').update(auxiliaryBytes).digest('hex')
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
}
