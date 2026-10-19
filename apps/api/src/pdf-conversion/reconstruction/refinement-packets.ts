import type { SourceRoleTask } from './generated/SourceRoleTask';
import type { SourceRoleResponse } from './generated/SourceRoleResponse';
import type { PresentationRefinementTask } from './generated/PresentationRefinementTask';
import type { PresentationRefinementResponse } from './generated/PresentationRefinementResponse';
import type { ContinuationRefinementBatch } from './generated/ContinuationRefinementBatch';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
import type { PrintedTitleTask } from './generated/PrintedTitleTask';
import type { PrintedTitleResponse } from './generated/PrintedTitleResponse';
import type { RefinementBatch } from './generated/RefinementBatch';
import type { PrintedTitleRefinementBatch } from './generated/PrintedTitleRefinementBatch';
import type { FrontmatterTitleTask } from './generated/FrontmatterTitleTask';
import type { FrontmatterTitleResponse } from './generated/FrontmatterTitleResponse';
import type { FrontmatterTitleRefinementBatch } from './generated/FrontmatterTitleRefinementBatch';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
export type RefinementTask =
  | SourceRoleTask
  | PresentationRefinementTask
  | BookRefinementTask
  | SourceFeatureTask
  | PrintedTitleTask
  | FrontmatterTitleTask;
export type RefinementResponse =
  | SourceRoleResponse
  | PresentationRefinementResponse
  | BookRefinementResponse
  | SourceFeatureResponse
  | PrintedTitleResponse
  | FrontmatterTitleResponse;
export type RefinementBatchPacket =
  | ContinuationRefinementBatch
  | RefinementBatch
  | PrintedTitleRefinementBatch
  | FrontmatterTitleRefinementBatch;
export function validateRefinementTask(input: RefinementTask): RefinementTask {
  if (input.schema_version === 'ava-book-refinement-task-6')
    return validatePacket('SourceRoleTask', input);

  if (input.schema_version === 'ava-book-refinement-task-5')
    return validatePacket('PresentationRefinementTask', input);
  if (input.schema_version === 'ava-printed-title-task-2')
    return validatePacket('FrontmatterTitleTask', input);
  if (input.schema_version === 'ava-printed-title-task-1')
    return validatePacket('PrintedTitleTask', input);
  if (input.schema_version === 'ava-book-refinement-task-4')
    return validatePacket('SourceFeatureTask', input);
  return validatePacket('BookRefinementTask', input);
}
export function refinementResponseName(task: RefinementTask) {
  if (task.schema_version === 'ava-book-refinement-task-6')
    return 'SourceRoleResponse' as const;
  if (task.schema_version === 'ava-book-refinement-task-5')
    return 'PresentationRefinementResponse' as const;
  if (task.schema_version === 'ava-printed-title-task-2')
    return 'FrontmatterTitleResponse' as const;
  if (task.schema_version === 'ava-printed-title-task-1')
    return 'PrintedTitleResponse' as const;
  return task.schema_version === 'ava-book-refinement-task-4'
    ? ('SourceFeatureResponse' as const)
    : ('BookRefinementResponse' as const);
}
export function validateRefinementBatch(value: unknown): RefinementBatchPacket {
  if (
    value &&
    typeof value === 'object' &&
    'schema_version' in value &&
    value.schema_version === 'ava-book-refinement-batch-4'
  )
    return validatePacket('ContinuationRefinementBatch', value);
  if (
    value &&
    typeof value === 'object' &&
    'schema_version' in value &&
    value.schema_version === 'ava-book-refinement-batch-3'
  )
    return validatePacket('FrontmatterTitleRefinementBatch', value);
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
