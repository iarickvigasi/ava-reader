import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
import type { PrintedTitleTask } from './generated/PrintedTitleTask';
import type { PrintedTitleResponse } from './generated/PrintedTitleResponse';
import type { RefinementBatch } from './generated/RefinementBatch';
import type { PrintedTitleRefinementBatch } from './generated/PrintedTitleRefinementBatch';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
export type RefinementTask =
  | BookRefinementTask
  | SourceFeatureTask
  | PrintedTitleTask;
export type RefinementResponse =
  | BookRefinementResponse
  | SourceFeatureResponse
  | PrintedTitleResponse;
export type RefinementBatchPacket =
  | RefinementBatch
  | PrintedTitleRefinementBatch;
export function validateRefinementTask(input: RefinementTask): RefinementTask {
  if (input.schema_version === 'ava-printed-title-task-1')
    return validatePacket('PrintedTitleTask', input);
  if (input.schema_version === 'ava-book-refinement-task-4')
    return validatePacket('SourceFeatureTask', input);
  return validatePacket('BookRefinementTask', input);
}
export function refinementResponseName(task: RefinementTask) {
  if (task.schema_version === 'ava-printed-title-task-1')
    return 'PrintedTitleResponse' as const;
  return task.schema_version === 'ava-book-refinement-task-4'
    ? ('SourceFeatureResponse' as const)
    : ('BookRefinementResponse' as const);
}
export function validateRefinementBatch(value: unknown): RefinementBatchPacket {
  const current = Boolean(
    value &&
    typeof value === 'object' &&
    'schema_version' in value &&
    value.schema_version === 'ava-book-refinement-batch-2',
  );
  if (!current) return validatePacket('RefinementBatch', value);
  return validatePacket('PrintedTitleRefinementBatch', value);
}
export function parseRefinementBatch(
  bytes: Buffer,
  limit: number,
): RefinementBatchPacket {
  if (bytes.length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
  try {
    return validateRefinementBatch(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      ) as unknown,
    );
  } catch (error) {
    if (error instanceof PdfRuntimeError) throw error;
    throw new PdfRuntimeError('INVALID_RESULT');
  }
}
