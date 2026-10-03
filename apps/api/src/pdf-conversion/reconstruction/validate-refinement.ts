import { createHash } from 'node:crypto';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';

export async function validateRefinement(
  task: BookRefinementTask,
  response: BookRefinementResponse | null,
  sandbox: CoordinatorDependencies['sandbox'],
  input: () => SandboxInput,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({ mode: 'validate_refinement', task, response }),
  );
  if (auxiliaryBytes.length > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const result = await sandbox({ ...input(), auxiliaryBytes });
  if (result.exitCode !== 0 || result.stdout.length > 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  let receipt: unknown;
  try {
    receipt = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(result.stdout),
    );
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt))
    throw new PdfRuntimeError('INVALID_RESULT');
  const value = receipt as Record<string, unknown>;
  if (
    Object.keys(value).sort().join(',') !==
      'request_sha256,schema_version,valid' ||
    value.schema_version !== 'ava-refinement-validation-1' ||
    value.valid !== true ||
    value.request_sha256 !==
      createHash('sha256').update(auxiliaryBytes).digest('hex')
  )
    throw new PdfRuntimeError('INVALID_RESULT');
}
