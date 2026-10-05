import { createHash } from 'node:crypto';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parseSourceRefusal } from './source-refusal';

export async function validateRefinement(
  task: BookRefinementTask | SourceFeatureTask,
  response: BookRefinementResponse | SourceFeatureResponse | null,
  sandbox: CoordinatorDependencies['sandbox'],
  input: () => SandboxInput,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({ mode: 'validate_refinement', task, response }),
  );
  if (auxiliaryBytes.length > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const result = await sandbox({ ...input(), auxiliaryBytes });
  if (result.exitCode === 1)
    throw parseSourceRefusal(result.stdout, task.source_sha256);
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
